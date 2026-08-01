import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import RefreshToken from "../models/RefreshToken.js";

const ACCESS_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 15 * 60);
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7);

export const signAccessToken = (userId, tokenVersion) => {
    const payload = { id: userId };
    if (tokenVersion != null) payload.tokenVersion = tokenVersion;
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: `${ACCESS_TTL_SECONDS}s` });
};

export const bumpTokenVersion = async (userId) => {
    try {
        await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } }).lean();
    } catch {}
};

export const hashOpaqueToken = (raw) => crypto.createHash("sha256").update(raw).digest("hex");

export const issueRefreshToken = async (userId, { userAgent, ip } = {}) => {
    const raw = crypto.randomBytes(40).toString("hex");
    const tokenHash = hashOpaqueToken(raw);
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
    // One refresh token is the server-side definition of one active session.
    // Replacing it makes a new login or rotation invalidate every older cookie.
    await RefreshToken.deleteMany({ user: userId });
    await RefreshToken.create({ user: userId, tokenHash, expiresAt, userAgent, ip });
    return { raw, expiresAt };
};

export const validateRefreshToken = async (raw) => {
    const tokenHash = hashOpaqueToken(raw);
    const record = await RefreshToken.findOne({ tokenHash }).lean();
    if (!record) return null;
    if (record.expiresAt < new Date()) {
        await RefreshToken.deleteOne({ _id: record._id });
        return null;
    }
    return record.user;
};

export const revokeAllRefreshTokens = async (userId) => {
    await RefreshToken.deleteMany({ user: userId });
};

export default {
    signAccessToken,
    hashOpaqueToken,
};
