import crypto from "crypto";
import jwt from "jsonwebtoken";
import getRedisClient from "../config/redis.js";
import metrics from "../metrics/index.js";

const ACCESS_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 15 * 60); // 15m
const REFRESH_TTL_SECONDS = Number(process.env.REFRESH_TOKEN_TTL_SECONDS || 7 * 24 * 60 * 60); // 7d

const isLocalHost = (host) => {
    const h = (host || "").toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "::1" || /^(\d+\.){3}\d+$/.test(h);
};

const cookieBase = (req) => {
    const isProd = process.env.NODE_ENV === "production";
    const isHttps = !!req?.secure;
    let sameSite = isProd ? (process.env.COOKIE_SAMESITE || "lax").toLowerCase() : "lax";
    if (isProd && sameSite === "none" && !isHttps) sameSite = "lax"; // browsers drop None without Secure
    const envDomain = process.env.COOKIE_DOMAIN || undefined;
    const domain = isProd && !isLocalHost(req?.hostname) ? envDomain : undefined;
    const secure = isProd && isHttps;
    return { sameSite, domain, secure };
};

const accessCookieOptions = (req) => {
    const base = cookieBase(req);
    return {
        httpOnly: true,
        secure: base.secure,
        sameSite: base.sameSite,
        domain: base.domain,
        path: "/",
        maxAge: ACCESS_TTL_SECONDS * 1000,
    };
};

const refreshCookieOptions = (req) => {
    const base = cookieBase(req);
    // Prefer stricter sameSite for refresh token if possible
    const sameSite = base.sameSite === "none" ? "none" : "lax";
    return {
        httpOnly: true,
        secure: base.secure,
        sameSite,
        domain: base.domain,
        path: "/",
        maxAge: REFRESH_TTL_SECONDS * 1000,
    };
};

const hashToken = (raw) => crypto.createHash("sha256").update(raw).digest("hex");

export const signAccessToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: `${ACCESS_TTL_SECONDS}s` });
};

const userSetKey = (userId) => `user:${userId}:rts`;

const saveRefresh = async (hashed, userId, meta) => {
    const client = await getRedisClient();
    if (!client) return; // best-effort; without Redis, skip server-side revocation
    const now = Date.now();
    const key = `rt:${hashed}`;
    const payload = JSON.stringify({ userId, createdAt: now, ...meta });
    await client.set(key, payload, { EX: REFRESH_TTL_SECONDS });
    await client.zAdd(userSetKey(userId), [{ score: now, value: hashed }]);
    // Enforce per-user session limit
    const maxSessions = Number(process.env.MAX_SESSIONS_PER_USER || 5);
    try {
        const count = await client.zCard(userSetKey(userId));
        if (count > maxSessions) {
            const oldest = await client.zRange(userSetKey(userId), 0, 0);
            if (oldest && oldest.length > 0) {
                await client.zRem(userSetKey(userId), oldest[0]);
                await client.del(`rt:${oldest[0]}`);
            }
        }
    } catch {}
};

const deleteRefresh = async (hashed) => {
    try {
        const client = await getRedisClient();
        if (!client) return;
        const payload = await client.get(`rt:${hashed}`);
        if (payload) {
            try {
                const parsed = JSON.parse(payload);
                if (parsed?.userId) await client.zRem(userSetKey(parsed.userId), hashed);
            } catch {}
        }
        await client.del(`rt:${hashed}`);
    } catch {}
};

export const revokeRefreshFromRequest = async (req) => {
    try {
        const raw = req.cookies?.refreshToken;
        if (!raw) return;
        await deleteRefresh(hashToken(raw));
    } catch {}
};

export const issueAuthCookies = async (req, res, userId) => {
    const access = signAccessToken(userId);
    const refreshRaw = crypto.randomBytes(32).toString("hex");
    const refreshHashed = hashToken(refreshRaw);
    const meta = { ip: req.ip, ua: req.get("user-agent") };
    await saveRefresh(refreshHashed, userId, meta);
    res.cookie("accessToken", access, accessCookieOptions(res.req));
    res.cookie("refreshToken", refreshRaw, refreshCookieOptions(res.req));
};

export const rotateRefresh = async (req, res) => {
    const raw = req.cookies?.refreshToken;
    if (!raw) return null;
    const hashed = hashToken(raw);
    const client = await getRedisClient();
    if (!client) return null;
    const key = `rt:${hashed}`;
    const payload = await client.get(key);
    if (!payload) return null;
    let userId = null;
    try { userId = JSON.parse(payload)?.userId || null; } catch { userId = null; }
    if (!userId) return null;
    // rotate: delete old, create new
    await client.del(key);
    await client.zRem(userSetKey(userId), hashed);
    const access = signAccessToken(userId);
    const newRaw = crypto.randomBytes(32).toString("hex");
    const newHashed = hashToken(newRaw);
    const meta = { ip: req.ip, ua: req.get("user-agent") };
    await saveRefresh(newHashed, userId, meta);
    res.cookie("accessToken", access, accessCookieOptions(req));
    res.cookie("refreshToken", newRaw, refreshCookieOptions(req));
    try { metrics.tokensRotatedTotal.inc(); } catch {}
    return userId;
};

export const clearAuthCookies = (res) => {
    try {
        res.cookie("accessToken", "", { ...accessCookieOptions(res.req), maxAge: 0 });
        res.cookie("refreshToken", "", { ...refreshCookieOptions(res.req), maxAge: 0 });
    } catch {}
};

export const hashOpaqueToken = (raw) => hashToken(raw);

export const listUserSessions = async (userId) => {
    const client = await getRedisClient();
    if (!client) return [];
    const hashes = await client.zRangeWithScores(userSetKey(userId), 0, -1);
    const results = [];
    for (const { value: h, score } of hashes) {
        try {
            const payload = await client.get(`rt:${h}`);
            if (!payload) continue;
            const data = JSON.parse(payload);
            results.push({ id: h, createdAt: new Date(data.createdAt || score).toISOString(), ip: data.ip, ua: data.ua });
        } catch {}
    }
    return results.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
};

export const revokeSessionById = async (userId, sessionId) => {
    try {
        const client = await getRedisClient();
        if (!client) return false;
        // Ensure session belongs to user
        const payload = await client.get(`rt:${sessionId}`);
        if (!payload) return false;
        const parsed = JSON.parse(payload);
        if (String(parsed?.userId) !== String(userId)) return false;
        await client.del(`rt:${sessionId}`);
        await client.zRem(userSetKey(userId), sessionId);
        try { metrics.sessionsRevokedTotal.labels("one").inc(); } catch {}
        return true;
    } catch { return false; }
};

export const revokeAllSessionsForUser = async (userId) => {
    try {
        const client = await getRedisClient();
        if (!client) return;
        const hashes = await client.zRange(userSetKey(userId), 0, -1);
        if (hashes && hashes.length) {
            const pipeline = client.multi();
            for (const h of hashes) {
                pipeline.del(`rt:${h}`);
                pipeline.zRem(userSetKey(userId), h);
            }
            await pipeline.exec();
        }
        try { metrics.sessionsRevokedTotal.labels("all").inc(); } catch {}
    } catch {}
};

export default {
    issueAuthCookies,
    rotateRefresh,
    revokeRefreshFromRequest,
    clearAuthCookies,
    signAccessToken,
    listUserSessions,
    revokeSessionById,
    revokeAllSessionsForUser,
};
