import crypto from "crypto";
import express from "express";
import { z } from "zod";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import OrganizationMembership from "../models/OrganizationMembership.js";
import SSOLoginAttempt from "../models/SSOLoginAttempt.js";
import AuditLog from "../models/AuditLog.js";
import protect from "../middleware/authMiddleware.js";
import { organizationContext, requireOrganizationRole } from "../middleware/organizationContext.js";
import validate from "../middleware/validate.js";
import { bumpTokenVersion, issueRefreshToken, revokeAllRefreshTokens, signAccessToken } from "../utils/tokens.js";
import {
    createOidcLoginState,
    discoverOidcProvider,
    emailDomain,
    encryptSsoSecret,
    exchangeAuthorizationCode,
    hashSsoToken,
    normalizeSsoDomain,
    verifyOidcIdToken,
} from "../services/oidcSso.js";

const router = express.Router();

const emailSchema = z.object({ email: z.string().trim().email().max(254) });
const exchangeSchema = z.object({ exchangeCode: z.string().min(20).max(500) });
const settingsSchema = z.object({
    enabled: z.boolean(),
    issuer: z.string().trim().url().max(500),
    clientId: z.string().trim().min(2).max(500),
    clientSecret: z.string().min(8).max(2000).optional(),
    domains: z.array(z.string().trim().min(1).max(253)).min(1).max(20),
    tokenAuthMethod: z.enum(["client_secret_post", "client_secret_basic"]).default("client_secret_post"),
    jitProvisioning: z.boolean().default(false),
    defaultRole: z.enum(["recruiter", "hiring_manager", "reviewer"]).default("reviewer"),
});

const clientOrigin = () => (process.env.CLIENT_ORIGIN || "http://localhost:5173").replace(/\/+$/, "");
const serverOrigin = (req) => (process.env.SERVER_ORIGIN || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
const callbackUri = (req) => `${serverOrigin(req)}/api/sso/callback`;
const refreshCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.COOKIE_SAMESITE || (process.env.NODE_ENV === "production" ? "strict" : "lax"),
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: "/api/auth",
});
const setRefreshCookie = (res, raw, expiresAt) => res.cookie("refreshToken", raw, { ...refreshCookieOptions(), expires: expiresAt });
const ssoAvailableFor = (organization) => organization.hiringPlan === "enterprise" || process.env.SSO_ALLOW_NON_ENTERPRISE === "true" || process.env.NODE_ENV !== "production";

const findSsoOrganizationForEmail = async (email, includeSecret = false) => {
    const domain = emailDomain(email);
    if (!domain) return null;
    let query = Organization.findOne({ "sso.enabled": true, "sso.domains": domain });
    if (includeSecret) query = query.select("+sso.clientSecretEncrypted");
    return query;
};

router.post("/discover", validate(emailSchema), async (req, res, next) => {
    try {
        const organization = await findSsoOrganizationForEmail(req.body.email);
        if (!organization || !ssoAvailableFor(organization)) return res.json({ available: false });
        return res.json({ available: true, organization: { _id: organization._id, name: organization.name } });
    } catch (error) { return next(error); }
});

router.post("/start", validate(emailSchema), async (req, res, next) => {
    try {
        const email = req.body.email.trim().toLowerCase();
        const organization = await findSsoOrganizationForEmail(email, true);
        if (!organization || !ssoAvailableFor(organization)) return res.status(404).json({ message: "No organization SSO is configured for this email" });
        const config = organization.sso;
        if (!config?.clientSecretEncrypted) return res.status(503).json({ message: "Organization SSO is incomplete" });
        const metadata = await discoverOidcProvider(config.issuer);
        const { state, stateHash, nonce, codeVerifier, codeChallenge } = createOidcLoginState();
        await SSOLoginAttempt.create({
            organization: organization._id,
            emailHint: email,
            stateHash,
            nonce,
            codeVerifier,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        });
        const url = new URL(metadata.authorization_endpoint);
        url.searchParams.set("client_id", config.clientId);
        url.searchParams.set("redirect_uri", callbackUri(req));
        url.searchParams.set("response_type", "code");
        url.searchParams.set("scope", "openid email profile");
        url.searchParams.set("state", state);
        url.searchParams.set("nonce", nonce);
        url.searchParams.set("code_challenge", codeChallenge);
        url.searchParams.set("code_challenge_method", "S256");
        url.searchParams.set("login_hint", email);
        return res.json({ authorizationUrl: url.toString(), organization: { _id: organization._id, name: organization.name } });
    } catch (error) { return next(error); }
});

router.get("/callback", async (req, res) => {
    const fail = (message) => res.redirect(`${clientOrigin()}/sso/callback?error=${encodeURIComponent(message)}`);
    try {
        const code = typeof req.query.code === "string" ? req.query.code : "";
        const state = typeof req.query.state === "string" ? req.query.state : "";
        if (!code || !state) return fail("SSO sign-in was not completed");
        const attempt = await SSOLoginAttempt.findOne({ stateHash: hashSsoToken(state), status: "started", expiresAt: { $gt: new Date() } })
            .select("+stateHash +codeVerifier +nonce")
            .populate({ path: "organization", select: "+sso.clientSecretEncrypted" });
        const organization = attempt?.organization;
        if (!attempt || !organization?.sso?.enabled || !ssoAvailableFor(organization)) return fail("SSO sign-in expired or is unavailable");
        const config = organization.sso;
        const metadata = await discoverOidcProvider(config.issuer);
        const tokens = await exchangeAuthorizationCode({ metadata, config, code, codeVerifier: attempt.codeVerifier, redirectUri: callbackUri(req) });
        if (!tokens?.id_token) return fail("Identity provider did not return an ID token");
        const claims = await verifyOidcIdToken({ idToken: tokens.id_token, metadata, clientId: config.clientId, nonce: attempt.nonce });
        const email = String(claims.email || claims.preferred_username || claims.upn || "").trim().toLowerCase();
        const domain = emailDomain(email);
        if (!email || claims.email_verified === false || !config.domains.includes(domain)) return fail("Your identity is not allowed for this organization");

        const identityMatch = { organization: organization._id, issuer: metadata.issuer, subject: claims.sub };
        let user = await User.findOne({ ssoIdentities: { $elemMatch: identityMatch } });
        if (!user) user = await User.findOne({ email });
        if (user) {
            const existingForOrganization = user.ssoIdentities?.find((identity) => String(identity.organization) === String(organization._id));
            if (existingForOrganization && (existingForOrganization.issuer !== metadata.issuer || existingForOrganization.subject !== claims.sub)) {
                return fail("This CompanionAI account is linked to a different SSO identity");
            }
            if (!existingForOrganization) user.ssoIdentities.push(identityMatch);
            user.isVerified = true;
            if (!user.name && claims.name) user.name = String(claims.name).slice(0, 160);
            await user.save();
        } else {
            user = await User.create({
                name: String(claims.name || email.split("@")[0] || "User").slice(0, 160),
                email,
                provider: "sso",
                isVerified: true,
                ssoIdentities: [identityMatch],
            });
        }

        let membership = await OrganizationMembership.findOne({ organization: organization._id, user: user._id });
        if (membership?.status === "disabled") return fail("Your organization access is disabled");
        if (!membership) {
            if (!config.jitProvisioning) return fail("Ask your organization admin to add you before using SSO");
            membership = await OrganizationMembership.create({ organization: organization._id, user: user._id, role: config.defaultRole, status: "active" });
        }

        const exchangeCode = crypto.randomBytes(32).toString("base64url");
        attempt.status = "authenticated";
        attempt.user = user._id;
        attempt.exchangeCodeHash = hashSsoToken(exchangeCode);
        attempt.expiresAt = new Date(Date.now() + 2 * 60 * 1000);
        await attempt.save();
        try { await AuditLog.create({ user: user._id, action: "auth.sso_authenticated", entityType: "Organization", entityId: organization._id, ip: req.ip, userAgent: req.get("user-agent"), requestId: req.id }); } catch {}
        return res.redirect(`${clientOrigin()}/sso/callback?exchange=${encodeURIComponent(exchangeCode)}&organization=${organization._id}`);
    } catch (error) {
        console.warn("OIDC callback failed:", error?.message || error);
        return fail("SSO sign-in failed");
    }
});

router.post("/exchange", validate(exchangeSchema), async (req, res, next) => {
    try {
        const attempt = await SSOLoginAttempt.findOne({ exchangeCodeHash: hashSsoToken(req.body.exchangeCode), status: "authenticated", expiresAt: { $gt: new Date() } })
            .select("+exchangeCodeHash")
            .populate("user");
        if (!attempt?.user) return res.status(401).json({ message: "SSO exchange code is invalid or expired" });
        attempt.status = "exchanged";
        attempt.exchangeCodeHash = undefined;
        await attempt.save();
        const user = attempt.user;
        await bumpTokenVersion(user._id);
        await revokeAllRefreshTokens(user._id);
        const fresh = await User.findById(user._id).select("tokenVersion");
        const token = signAccessToken(user._id, fresh?.tokenVersion);
        const { raw, expiresAt } = await issueRefreshToken(user._id, { userAgent: req.get("user-agent"), ip: req.ip });
        setRefreshCookie(res, raw, expiresAt);
        try { await AuditLog.create({ user: user._id, action: "auth.sso_login", entityType: "Organization", entityId: attempt.organization, ip: req.ip, userAgent: req.get("user-agent"), requestId: req.id }); } catch {}
        return res.json({ token, organizationId: attempt.organization, user: { _id: user._id, name: user.name, email: user.email } });
    } catch (error) { return next(error); }
});

router.get("/settings", protect, organizationContext, requireOrganizationRole("owner", "admin"), async (req, res, next) => {
    try {
        const organization = await Organization.findById(req.organizationId).select("+sso.clientSecretEncrypted");
        const sso = organization?.sso || {};
        return res.json({
            availableOnPlan: ssoAvailableFor(organization),
            enabled: Boolean(sso.enabled),
            issuer: sso.issuer || "",
            clientId: sso.clientId || "",
            hasClientSecret: Boolean(sso.clientSecretEncrypted),
            domains: sso.domains || [],
            tokenAuthMethod: sso.tokenAuthMethod || "client_secret_post",
            jitProvisioning: Boolean(sso.jitProvisioning),
            defaultRole: sso.defaultRole || "reviewer",
        });
    } catch (error) { return next(error); }
});

router.put("/settings", protect, organizationContext, requireOrganizationRole("owner", "admin"), validate(settingsSchema), async (req, res, next) => {
    try {
        const organization = await Organization.findById(req.organizationId).select("+sso.clientSecretEncrypted");
        if (!organization) return res.status(404).json({ message: "Organization not found" });
        if (req.body.enabled && !ssoAvailableFor(organization)) return res.status(402).json({ message: "Organization SSO is available on the Enterprise Hiring plan" });
        const domains = [...new Set(req.body.domains.map(normalizeSsoDomain).filter(Boolean))];
        if (!domains.length) return res.status(400).json({ message: "At least one valid SSO domain is required" });
        const conflict = await Organization.findOne({ _id: { $ne: organization._id }, "sso.enabled": true, "sso.domains": { $in: domains } }).select("name").lean();
        if (conflict) return res.status(409).json({ message: "One of these domains is already claimed by another organization" });
        if (req.body.enabled && !req.body.clientSecret && !organization.sso?.clientSecretEncrypted) return res.status(400).json({ message: "OIDC client secret is required before enabling SSO" });
        await discoverOidcProvider(req.body.issuer);
        organization.sso.enabled = req.body.enabled;
        organization.sso.issuer = req.body.issuer.replace(/\/+$/, "");
        organization.sso.clientId = req.body.clientId;
        organization.sso.domains = domains;
        organization.sso.tokenAuthMethod = req.body.tokenAuthMethod;
        organization.sso.jitProvisioning = req.body.jitProvisioning;
        organization.sso.defaultRole = req.body.defaultRole;
        organization.sso.configuredAt = new Date();
        if (req.body.clientSecret) organization.sso.clientSecretEncrypted = encryptSsoSecret(req.body.clientSecret);
        await organization.save();
        try { await AuditLog.create({ user: req.user._id, action: "organization.sso_update", entityType: "Organization", entityId: organization._id, ip: req.ip, userAgent: req.get("user-agent"), requestId: req.id }); } catch {}
        return res.json({ message: "SSO settings saved", enabled: organization.sso.enabled });
    } catch (error) {
        if (/OIDC|HTTPS|public addresses|issuer/i.test(error?.message || "")) return res.status(400).json({ message: error.message });
        return next(error);
    }
});

export default router;
