import crypto from "crypto";
import dns from "dns/promises";
import net from "net";
import jwt from "jsonwebtoken";

const normalizeIssuer = (value = "") => value.trim().replace(/\/+$/, "");
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const base64url = (buffer) => Buffer.from(buffer).toString("base64url");

const isPrivateIp = (address) => {
    if (net.isIPv4(address)) {
        const [a, b] = address.split(".").map(Number);
        return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 0;
    }
    if (net.isIPv6(address)) {
        const value = address.toLowerCase();
        return value === "::1" || value === "::" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb");
    }
    return true;
};

export const assertSafeOidcUrl = async (raw) => {
    const url = new URL(raw);
    if (url.protocol !== "https:") throw new Error("OIDC endpoints must use HTTPS");
    const hostname = url.hostname.toLowerCase();
    if (["localhost", "localhost.localdomain"].includes(hostname)) throw new Error("Private OIDC endpoints are not allowed");
    if (net.isIP(hostname) && isPrivateIp(hostname)) throw new Error("Private OIDC endpoints are not allowed");
    if (!net.isIP(hostname)) {
        const addresses = await dns.lookup(hostname, { all: true });
        if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) throw new Error("OIDC hostname must resolve only to public addresses");
    }
    return url;
};

const fetchJson = async (url, options = {}) => {
    await assertSafeOidcUrl(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
        const response = await fetch(url, { ...options, redirect: "error", signal: controller.signal });
        if (!response.ok) throw new Error(`OIDC provider returned ${response.status}`);
        return await response.json();
    } finally {
        clearTimeout(timeout);
    }
};

export const discoverOidcProvider = async (issuer) => {
    const normalized = normalizeIssuer(issuer);
    await assertSafeOidcUrl(normalized);
    const metadata = await fetchJson(`${normalized}/.well-known/openid-configuration`);
    if (normalizeIssuer(metadata?.issuer) !== normalized) throw new Error("OIDC issuer mismatch");
    for (const field of ["authorization_endpoint", "token_endpoint", "jwks_uri"]) {
        if (!metadata?.[field]) throw new Error(`OIDC discovery missing ${field}`);
        await assertSafeOidcUrl(metadata[field]);
    }
    return metadata;
};

const encryptionKey = () => {
    const value = process.env.SSO_ENCRYPTION_KEY || "";
    if (value.length < 32) throw new Error("SSO_ENCRYPTION_KEY must be at least 32 characters");
    return crypto.createHash("sha256").update(value).digest();
};

export const encryptSsoSecret = (plaintext) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${base64url(iv)}.${base64url(tag)}.${base64url(ciphertext)}`;
};

export const decryptSsoSecret = (encoded) => {
    const [ivRaw, tagRaw, ciphertextRaw] = String(encoded || "").split(".");
    if (!ivRaw || !tagRaw || !ciphertextRaw) throw new Error("Invalid encrypted SSO secret");
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64url"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, "base64url")), decipher.final()]).toString("utf8");
};

export const createOidcLoginState = () => {
    const state = base64url(crypto.randomBytes(32));
    const nonce = base64url(crypto.randomBytes(32));
    const codeVerifier = base64url(crypto.randomBytes(48));
    const codeChallenge = base64url(crypto.createHash("sha256").update(codeVerifier).digest());
    return { state, stateHash: hash(state), nonce, codeVerifier, codeChallenge };
};

export const hashSsoToken = hash;

export const exchangeAuthorizationCode = async ({ metadata, config, code, codeVerifier, redirectUri }) => {
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: config.clientId,
        code_verifier: codeVerifier,
    });
    const headers = { "content-type": "application/x-www-form-urlencoded", accept: "application/json" };
    const clientSecret = decryptSsoSecret(config.clientSecretEncrypted);
    if (config.tokenAuthMethod === "client_secret_basic") {
        headers.authorization = `Basic ${Buffer.from(`${config.clientId}:${clientSecret}`).toString("base64")}`;
    } else {
        body.set("client_secret", clientSecret);
    }
    return fetchJson(metadata.token_endpoint, { method: "POST", headers, body: body.toString() });
};

export const verifyOidcIdToken = async ({ idToken, metadata, clientId, nonce }) => {
    const decoded = jwt.decode(idToken, { complete: true });
    const alg = decoded?.header?.alg;
    const kid = decoded?.header?.kid;
    const allowedAlgorithms = ["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"];
    if (!kid || !allowedAlgorithms.includes(alg)) throw new Error("Unsupported OIDC signing key");
    const jwks = await fetchJson(metadata.jwks_uri);
    const jwk = jwks?.keys?.find((item) => item.kid === kid && (!item.use || item.use === "sig"));
    if (!jwk) throw new Error("OIDC signing key not found");
    const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });
    const claims = jwt.verify(idToken, publicKey, {
        algorithms: [alg],
        audience: clientId,
        issuer: metadata.issuer,
        clockTolerance: 30,
    });
    if (!claims?.sub || claims.nonce !== nonce) throw new Error("Invalid OIDC nonce");
    return claims;
};

export const emailDomain = (email = "") => email.trim().toLowerCase().split("@")[1] || "";
export const normalizeSsoDomain = (domain = "") => domain.trim().toLowerCase().replace(/^@/, "");
