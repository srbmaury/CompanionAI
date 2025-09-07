import crypto from "crypto";
import User from "../models/User.js";
import { bumpTokenVersion } from "../utils/tokens.js";
import jwt from "jsonwebtoken";
const jwtSignWithVersion = (userId, tokenVersion) => {
    const ACCESS_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 15 * 60);
    const payload = { id: userId };
    if (tokenVersion != null) payload.tokenVersion = tokenVersion;
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: `${ACCESS_TTL_SECONDS}s` });
};
import { OAuth2Client } from "google-auth-library";
import metrics from "../metrics/index.js";
import { sendMail, buildVerificationEmail } from "../utils/mailer.js";
import bcrypt from "bcryptjs";
import { recordLoginFailure, clearLoginFailures } from "../middleware/loginLockout.js";
import AuditLog from "../models/AuditLog.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Register
export const registerUser = async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const userExists = await User.findOne({ email });
        if (userExists)
            return res.status(400).json({ message: "User already exists" });

        const verificationTokenRaw = crypto.randomBytes(32).toString("hex");
        const verificationTokenHashed = crypto.createHash("sha256").update(verificationTokenRaw).digest("hex");
        const verificationTokenExpires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h

        const user = await User.create({
            name,
            email,
            password,
            isVerified: false,
            verificationToken: verificationTokenHashed,
            verificationTokenExpires,
        });

        if (user) {
            const baseUrl = process.env.CLIENT_ORIGIN || "http://localhost:5173";
            const verifyUrl = `${baseUrl}/verify-email?token=${verificationTokenRaw}&email=${encodeURIComponent(email)}`;
            const mail = buildVerificationEmail(user.name || "there", verifyUrl);
            try {
                await sendMail({ to: email, ...mail });
            } catch (e) {
                // Non-fatal: still allow account creation
                console.warn("Email send failed:", e?.message || e);
            }

            try { metrics.authRegisterTotal.labels("success").inc(); } catch {}
            res.status(201).json({
                message: "Registered. Please verify your email to log in.",
            });
        } else {
            try { metrics.authRegisterTotal.labels("failure").inc(); } catch {}
            res.status(400).json({ message: "Invalid user data" });
        }
    } catch (error) {
        try { metrics.authRegisterTotal.labels("failure").inc(); } catch {}
        res.status(500).json({ message: error.message });
    }
};

// Login
export const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            await recordLoginFailure((email || "").toLowerCase());
            try { metrics.authLoginAttemptsTotal.labels("local", "failure").inc(); } catch {}
            return res.status(401).json({ message: "Invalid email or password" });
        }
        if (user.provider !== "local") {
            await recordLoginFailure((email || "").toLowerCase());
            return res.status(400).json({ message: "Use Google Sign-In for this account" });
        }
        if (!(await user.matchPassword(password))) {
            await recordLoginFailure((email || "").toLowerCase());
            try { metrics.authLoginAttemptsTotal.labels("local", "failure").inc(); } catch {}
            return res.status(401).json({ message: "Invalid email or password" });
        }
        if (!user.isVerified) {
            await recordLoginFailure((email || "").toLowerCase());
            try { metrics.authLoginAttemptsTotal.labels("local", "blocked").inc(); } catch {}
            return res.status(403).json({ message: "Email not verified" });
        }
        if (user && (await user.matchPassword(password))) {
            // Enforce max 1: bump tokenVersion so any previous tokens become invalid
            await bumpTokenVersion(user._id);
            const fresh = await User.findById(user._id).select("tokenVersion");
            const token = jwtSignWithVersion(user._id, fresh?.tokenVersion);
            res.json({ token, user: { _id: user._id, name: user.name, email: user.email } });
            try { await clearLoginFailures((email || "").toLowerCase()); } catch {}
            try { metrics.authLoginAttemptsTotal.labels("local", "success").inc(); } catch {}
            try { await AuditLog.create({ user: user._id, action: "auth.login", ip: req.ip, userAgent: req.get("user-agent"), requestId: req.id }); } catch {}
        } else {
            await recordLoginFailure((email || "").toLowerCase());
            try { metrics.authLoginAttemptsTotal.labels("local", "failure").inc(); } catch {}
            res.status(401).json({ message: "Invalid email or password" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Logout
export const logoutUser = async (req, res) => {
    res.status(200).json({ message: "Logged out successfully" });
    try { metrics.authLogoutTotal.inc(); } catch {}
    try { AuditLog.create({ user: req.user?._id, action: "auth.logout", ip: req.ip, userAgent: req.get("user-agent"), requestId: req.id }).catch(() => {}); } catch {}
};
// Verify email
export const verifyEmail = async (req, res) => {
    const { token, email } = req.body;
    try {
        const hashed = crypto.createHash("sha256").update(token).digest("hex");
        const user = await User.findOne({ email, verificationToken: hashed });
        if (!user) return res.status(400).json({ message: "Invalid token" });
        if (user.verificationTokenExpires && user.verificationTokenExpires < new Date()) {
            return res.status(400).json({ message: "Token expired" });
        }
        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpires = undefined;
        await user.save();
        try { metrics.authVerifyTotal.labels("verify", "success").inc(); } catch {}
        return res.json({ message: "Email verified. You can now log in." });
    } catch (err) {
        try { metrics.authVerifyTotal.labels("verify", "failure").inc(); } catch {}
        return res.status(500).json({ message: err.message });
    }
};

// Resend verification
export const resendVerification = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (user && !user.isVerified) {
            const verificationToken = crypto.randomBytes(32).toString("hex");
            user.verificationToken = crypto.createHash("sha256").update(verificationToken).digest("hex");
            user.verificationTokenExpires = new Date(Date.now() + 1000 * 60 * 60 * 24);
            await user.save();

            const baseUrl = process.env.CLIENT_ORIGIN || "http://localhost:5173";
            const verifyUrl = `${baseUrl}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
            const mail = buildVerificationEmail(user.name || "there", verifyUrl);
            try {
                await sendMail({ to: email, ...mail });
            } catch (e) {
                console.warn("Resend email failed:", e?.message || e);
            }
        }
        try { metrics.authVerifyTotal.labels("resend", "success").inc(); } catch {}
        return res.json({ message: "If the email exists, a verification email has been sent" });
    } catch (err) {
        try { metrics.authVerifyTotal.labels("resend", "failure").inc(); } catch {}
        return res.status(500).json({ message: err.message });
    }
};

// Google Sign-In with ID token
export const googleSignIn = async (req, res) => {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: "Missing idToken" });
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const email = payload?.email;
        const name = payload?.name || email?.split("@")[0] || "User";
        const googleId = payload?.sub;
        if (!email) return res.status(400).json({ message: "No email in token" });

        let user = await User.findOne({ email });
        if (!user) {
            user = await User.create({
                name,
                email,
                provider: "google",
                googleId,
                isVerified: true,
            });
        } else {
            if (user.provider === "local" && !user.isVerified) {
                user.isVerified = true; // trust Google verified email
            }
            if (!user.googleId) user.googleId = googleId;
            if (user.provider !== "google") user.provider = "google";
            await user.save();
        }

        await bumpTokenVersion(user._id);
        const fresh = await User.findById(user._id).select("tokenVersion");
        const token = jwtSignWithVersion(user._id, fresh?.tokenVersion);
        try { metrics.authLoginAttemptsTotal.labels("google", "success").inc(); } catch {}
        return res.json({ token, user: { _id: user._id, name: user.name, email: user.email } });
    } catch (err) {
        try { metrics.authLoginAttemptsTotal.labels("google", "failure").inc(); } catch {}
        return res.status(401).json({ message: "Invalid Google token" });
    }
};

// Update profile (name and/or password)
export const updateProfile = async (req, res) => {
    try {
        const { name, currentPassword, newPassword, preferredProgrammingLanguage } = req.body || {};

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (typeof name === "string" && name.trim()) {
            user.name = name.trim();
        }

        if (newPassword) {
            if (user.provider !== "local") {
                return res.status(400).json({ message: "Password change not available for Google accounts" });
            }
            if (!currentPassword) {
                return res.status(400).json({ message: "Current password is required" });
            }
            const matches = await user.matchPassword(currentPassword);
            if (!matches) {
                return res.status(400).json({ message: "Current password is incorrect" });
            }
            user.password = newPassword;
        }

        if (typeof preferredLanguage === "string" && preferredLanguage.trim()) {
            user.preferredLanguage = preferredLanguage.trim();
        }
        if (typeof preferredProgrammingLanguage === "string" && preferredProgrammingLanguage.trim()) {
            user.preferredProgrammingLanguage = preferredProgrammingLanguage.trim();
        }

        await user.save();
        try { metrics.securityPasswordChangeTotal.labels("success").inc(); } catch {}
        // Issue fresh access token rather than cookies
        await bumpTokenVersion(user._id);
        const fresh = await User.findById(user._id).select("tokenVersion");
        const token = jwtSignWithVersion(user._id, fresh?.tokenVersion);
        const safe = await User.findById(user._id).select("-password").lean();
        return res.json({ message: "Profile updated", token, user: safe });
    } catch (err) {
        try { metrics.securityPasswordChangeTotal.labels("failure").inc(); } catch {}
        return res.status(500).json({ message: err.message });
    }
};

export const forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.json({ message: "If the email exists, a reset link has been sent" });
        if (!user.isVerified) return res.status(400).json({ message: "Verify your email before resetting password" });

        const token = crypto.randomBytes(32).toString("hex");
        user.resetPasswordToken = crypto.createHash("sha256").update(token).digest("hex");
        user.resetPasswordExpires = new Date(Date.now() + 1000 * 60 * 30); // 30 min
        await user.save();
        // Stateless JWT: no server-side session store to revoke

        const baseUrl = process.env.CLIENT_ORIGIN || "http://localhost:5173";
        const resetUrl = `${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
        const subject = "Reset your password";
        const html = `
            <div style="font-family: Arial, sans-serif; line-height:1.5;">
                <h2>Reset your password</h2>
                <p>We received a request to reset your password. Click the button below to proceed.</p>
                <p><a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;">Reset Password</a></p>
                <p>Or open this link: <a href="${resetUrl}">${resetUrl}</a></p>
                <p>If you did not request this, you can ignore this email.</p>
            </div>
        `;
        try {
            await sendMail({ to: email, subject, html, text: undefined });
        } catch (e) {
            console.warn("Reset email send failed:", e?.message || e);
        }
        try { metrics.authResetTotal.labels("forgot", "success").inc(); } catch {}
        try { await AuditLog.create({ user: user?._id, action: "auth.forgot", ip: req.ip, userAgent: req.get("user-agent"), requestId: req.id }); } catch {}
        return res.json({ message: "If the email exists, a reset link has been sent" });
    } catch (err) {
        try { metrics.authResetTotal.labels("forgot", "failure").inc(); } catch {}
        return res.status(500).json({ message: err.message });
    }
};

export const resetPassword = async (req, res) => {
    const { token, email, newPassword } = req.body;
    try {
        const hashed = crypto.createHash("sha256").update(token).digest("hex");
        const user = await User.findOne({ email, resetPasswordToken: hashed });
        if (!user) return res.status(400).json({ message: "Invalid token" });
        if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
            return res.status(400).json({ message: "Token expired" });
        }
        if (user.provider !== "local") {
            return res.status(400).json({ message: "Password reset not available for Google accounts" });
        }
        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        try { metrics.authResetTotal.labels("reset", "success").inc(); } catch {}
        try { await AuditLog.create({ user: user._id, action: "auth.reset", ip: req.ip, userAgent: req.get("user-agent"), requestId: req.id }); } catch {}
        return res.json({ message: "Password has been reset" });
    } catch (err) {
        try { metrics.authResetTotal.labels("reset", "failure").inc(); } catch {}
        return res.status(500).json({ message: err.message });
    }
};
