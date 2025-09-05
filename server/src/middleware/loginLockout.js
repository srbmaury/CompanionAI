import getRedisClient from "../config/redis.js";

const WINDOW_SECONDS = 15 * 60; // 15m
const MAX_ATTEMPTS = 10;
const LOCK_SECONDS = 30 * 60; // 30m

const key = (emailOrIp) => `login:attempts:${emailOrIp}`;
const lockKey = (emailOrIp) => `login:lock:${emailOrIp}`;

export const loginAttemptCheck = async (req, res, next) => {
    try {
        if (process.env.NODE_ENV !== "production") return next();
        const client = await getRedisClient();
        if (!client) return next();
        const identifier = (req.body?.email || req.ip || "unknown").toLowerCase();
        const isLocked = await client.get(lockKey(identifier));
        if (isLocked) {
            return res.status(423).json({ message: "Account temporarily locked due to repeated failures. Try again later." });
        }
        next();
    } catch {
        next();
    }
};

export const recordLoginFailure = async (identifier) => {
    try {
        if (process.env.NODE_ENV !== "production") return;
        const client = await getRedisClient();
        if (!client) return;
        const k = key(identifier);
        const attempts = (await client.incr(k)) || 0;
        if (attempts === 1) await client.expire(k, WINDOW_SECONDS);
        if (attempts >= MAX_ATTEMPTS) {
            await client.set(lockKey(identifier), "1", { EX: LOCK_SECONDS });
        }
    } catch {}
};

export const clearLoginFailures = async (identifier) => {
    try {
        if (process.env.NODE_ENV !== "production") return;
        const client = await getRedisClient();
        if (!client) return;
        await client.del(key(identifier));
        await client.del(lockKey(identifier));
    } catch {}
};
