import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const ACCESS_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 15 * 60);

export const signAccessToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: `${ACCESS_TTL_SECONDS}s` });
};

export const bumpTokenVersion = async (userId) => {
    try {
        await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } }).lean();
    } catch {}
};

export const hashOpaqueToken = (raw) => crypto.createHash("sha256").update(raw).digest("hex");

export default {
    signAccessToken,
    hashOpaqueToken,
};
