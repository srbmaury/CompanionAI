import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import getRedisClient from "../config/redis.js";
import metrics from "../metrics/index.js";

const commonOptions = {
    standardHeaders: true,
    legacyHeaders: false,
};

const buildHandler = (message) => (req, res) => {
    try {
        const route = req.route?.path || req.path;
        metrics.rateLimitHitsTotal.labels(route).inc();
    } catch {}
    res.status(429).json({ message });
};

const withStore = async (options) => {
    if (process.env.NODE_ENV !== "production") return options;
    try {
        const client = await getRedisClient();
        if (!client) return options;
        return {
            ...options,
            store: new RedisStore({
                // @ts-ignore: provide node-redis v4 style sendCommand
                sendCommand: (...args) => client.sendCommand(args)
            }),
        };
    } catch {
        return options;
    }
};

export const loginLimiter = rateLimit(await withStore({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { message: "Too many login attempts, please try again later." },
    handler: buildHandler("Too many login attempts, please try again later."),
    ...commonOptions,
}));

export const googleLoginLimiter = rateLimit(await withStore({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { message: "Too many Google sign-ins, please try again later." },
    handler: buildHandler("Too many Google sign-ins, please try again later."),
    ...commonOptions,
}));

export const registerLimiter = rateLimit(await withStore({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: { message: "Too many signups from this IP, please try again later." },
    handler: buildHandler("Too many signups from this IP, please try again later."),
    ...commonOptions,
}));

export const forgotPasswordLimiter = rateLimit(await withStore({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { message: "Too many password reset attempts, please try again later." },
    handler: buildHandler("Too many password reset attempts, please try again later."),
    ...commonOptions,
}));

export const verifyEmailLimiter = rateLimit(await withStore({
    windowMs: 60 * 60 * 1000,
    max: 30,
    message: { message: "Too many verification attempts, please try again later." },
    handler: buildHandler("Too many verification attempts, please try again later."),
    ...commonOptions,
}));

export const resendVerificationLimiter = rateLimit(await withStore({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { message: "Too many verification emails requested, please try again later." },
    handler: buildHandler("Too many verification emails requested, please try again later."),
    ...commonOptions,
}));

export const resetPasswordLimiter = rateLimit(await withStore({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { message: "Too many password reset submissions, please try again later." },
    handler: buildHandler("Too many password reset submissions, please try again later."),
    ...commonOptions,
}));

export const codeExecLimiter = rateLimit(await withStore({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { message: "Too many code executions, please slow down." },
    handler: buildHandler("Too many code executions, please slow down."),
    ...commonOptions,
}));

export const sttLimiter = rateLimit(await withStore({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { message: "Too many transcription requests, please slow down." },
    handler: buildHandler("Too many transcription requests, please slow down."),
    ...commonOptions,
}));

export const uploadLimiter = rateLimit(await withStore({
    windowMs: 60 * 60 * 1000,
    max: 50,
    message: { message: "Too many uploads, please try again later." },
    handler: buildHandler("Too many uploads, please try again later."),
    ...commonOptions,
}));
