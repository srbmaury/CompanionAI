import dotenv from "dotenv";
import connectDB from "./config/db.js";
import app from "./app.js";
import { verifyEmailProvider } from "./utils/mailer.js";
import cron from "node-cron";
import cloudinary from "./config/cloudinaryConfig.js";
import Resume from "./models/Resume.js";
import { createWorker } from "./queues/index.js";
import prepareQuestionsProcessor from "./queues/workers/prepareQuestions.js";
import bulkFeedbackProcessor from "./queues/workers/bulkFeedback.js";
import candidateAssessmentProcessor from "./queues/workers/candidateAssessment.js";
import { z } from "zod";
import mongoose from "mongoose";
import getRedisClient from "./config/redis.js";
import * as Sentry from "@sentry/node";
import { startOtlpPush } from "./metrics/otlpPush.js";
import { deliverDuePracticeReminders } from "./services/practiceReminders.js";
import CandidateAttempt from "./models/CandidateAttempt.js";
import Assessment from "./models/Assessment.js";
import { getQueue } from "./queues/index.js";
import { createJobId } from "./queues/jobIds.js";
import { processAssessmentLifecycle } from "./services/assessmentLifecycle.js";

dotenv.config();

// The production frontend and API can be on different sites (for example,
// separate Render subdomains). A Strict refresh cookie is withheld by the
// browser on those cross-site requests, which makes reload-time refresh fail.
// Keep localhost on Lax, but default production refresh cookies to None so the
// existing Secure + HttpOnly cookie can be sent with credentialed CORS calls.
if (process.env.NODE_ENV === "production" && !process.env.COOKIE_SAMESITE) {
    process.env.COOKIE_SAMESITE = "none";
}

// Initialize Sentry if configured
try {
    if (process.env.SENTRY_DSN) {
        Sentry.init({
            dsn: process.env.SENTRY_DSN,
            environment: process.env.NODE_ENV || "development",
            tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
        });
        // Expose for error handler
        // @ts-ignore
        global.Sentry = Sentry;
        console.log("Sentry initialized");
    }
} catch (e) {
    console.warn("Sentry init failed:", e?.message || e);
}

// Validate critical runtime configuration (prod)
try {
    if (process.env.NODE_ENV === "production") {
        // Redis must be configured for session/refresh token management and rate limiting
        if (!process.env.REDIS_URL) {
            console.error("REDIS_URL is required in production for session and rate limit management.");
            process.exit(1);
        }
        // Protect metrics endpoint with token
        if (!process.env.METRICS_TOKEN) {
            console.error("METRICS_TOKEN is required in production to protect /metrics endpoint.");
            process.exit(1);
        }
        if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL || !process.env.BREVO_WEBHOOK_SECRET) {
            console.error("BREVO_API_KEY, BREVO_SENDER_EMAIL, and BREVO_WEBHOOK_SECRET are required in production for transactional email and delivery tracking.");
            process.exit(1);
        }
        // Mandatory features: CAPTCHA in prod
        if (process.env.CAPTCHA_ENABLED !== "true" || !process.env.CAPTCHA_SECRET || process.env.CAPTCHA_LOGIN_ENABLED !== "true" || process.env.CAPTCHA_REGISTER_ENABLED !== "true") {
            console.error("CAPTCHA must protect login and registration in production: enable CAPTCHA and both auth gates, then set CAPTCHA_SECRET.");
            process.exit(1);
        }
        // STT feature requires OpenAI key if enabled
        if ((process.env.ENABLE_STT || "true").toLowerCase() === "true") {
            if (!process.env.OPENAI_API_KEY) {
                console.error("OPENAI_API_KEY is required when STT is enabled in production.");
                process.exit(1);
            }
        }
        // Code execution feature requires Judge0 URL allowlist
        if ((process.env.ENABLE_CODE_EXEC || "true").toLowerCase() === "true") {
            if (!process.env.JUDGE0_URL) {
                console.error("JUDGE0_URL is required when code execution is enabled in production.");
                process.exit(1);
            }
        }
        // Validate Judge0 URL host allowlist if configured
        if (process.env.JUDGE0_URL) {
            try {
                const u = new URL(process.env.JUDGE0_URL);
                const allowedHosts = (process.env.ALLOWED_JUDGE0_HOSTS || "")
                    .split(",")
                    .map((s) => s.trim().toLowerCase())
                    .filter(Boolean);
                if (allowedHosts.length > 0 && !allowedHosts.includes(u.hostname.toLowerCase())) {
                    console.error("JUDGE0_URL host not in ALLOWED_JUDGE0_HOSTS allowlist:", u.hostname);
                    process.exit(1);
                }
            } catch (e) {
                console.error("Invalid JUDGE0_URL:", e?.message || e);
                process.exit(1);
            }
        }
    }
} catch {}

// Startup env validation — fail fast for critical vars in all environments
const EnvSchema = z.object({
    NODE_ENV: z.string().optional(),
    PORT: z.string().optional(),
    JWT_SECRET: z.string().min(10, "JWT_SECRET must be at least 10 characters"),
    MONGO_URI: z.string().min(1, "MONGO_URI is required"),
    ALLOWED_ORIGINS: z.string().optional(),
    CLIENT_ORIGIN: z.string().optional(),
    SERVER_ORIGIN: z.string().optional(),
});
try {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
        const issues = parsed.error.errors.map((e) => `  ${e.path.join(".")}: ${e.message}`).join("\n");
        console.error(`[startup] Missing or invalid environment variables:\n${issues}`);
        process.exit(1);
    }
    // Warn if no AI provider is configured
    if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
        console.warn("[startup] Neither OPENAI_API_KEY nor GEMINI_API_KEY is set — AI features will fail.");
    }
} catch {}
await connectDB();

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    // Verify the Brevo API key on boot to catch misconfiguration early.
    const hasEmailConfig = process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL;
    if (hasEmailConfig) {
        try {
            await verifyEmailProvider();
        } catch {
            // already logged
        }
    } else {
        console.log("Brevo email not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL.");
    }

    // Start workers if Redis configured
    if (process.env.REDIS_URL) {
        try {
            await createWorker("prepare-questions", prepareQuestionsProcessor);
            console.log("[Workers] prepare-questions worker started");
            await createWorker("bulk-feedback", bulkFeedbackProcessor);
            console.log("[Workers] bulk-feedback worker started");
            await createWorker("candidate-assessment", candidateAssessmentProcessor);
            console.log("[Workers] candidate-assessment worker started");
            const assessmentQueue = await getQueue("candidate-assessment");
            const strandedAttempts = await CandidateAttempt.find({ status: "evaluating", evaluationStartedAt: { $ne: null } }).select("evaluationStartedAt").lean();
            for (const attempt of strandedAttempts) {
                const jobId = createJobId("candidate-assessment", { attemptId: String(attempt._id), evaluationStartedAt: attempt.evaluationStartedAt.toISOString() });
                await assessmentQueue.add("evaluate", { attemptId: String(attempt._id) }, { jobId, removeOnComplete: { age: 86400, count: 1000 }, removeOnFail: { age: 604800, count: 1000 } });
            }
            if (strandedAttempts.length) console.log(`[Workers] recovered ${strandedAttempts.length} candidate assessment evaluations`);
        } catch (e) {
            console.warn("[Workers] Failed to start prepare-questions worker", e?.message || e);
        }
    } else {
        console.log("[Workers] REDIS_URL not set, background workers disabled");
    }

    // Daily cleanup: remove Cloudinary raw assets with no DB reference
    try {
        cron.schedule("0 3 * * *", async () => {
            if (!process.env.CLOUDINARY_CLOUD_NAME) return;
            console.log("[CLEANUP] Starting orphan Cloudinary resume cleanup...");
            try {
                const { resources = [], next_cursor } = await cloudinary.api.resources({
                    type: "upload",
                    resource_type: "raw",
                    prefix: "resumes/",
                    max_results: 500,
                });
                const publicIds = resources.map((r) => r.public_id);
                if (publicIds.length === 0) return console.log("[CLEANUP] No raw resources found");
                const existing = await Resume.find({ publicId: { $in: publicIds } }).select("publicId").lean();
                const existingSet = new Set(existing.map((r) => r.publicId));
                const orphans = publicIds.filter((pid) => !existingSet.has(pid));
                if (orphans.length === 0) return console.log("[CLEANUP] No orphans found");
                const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, (i + 1) * n));
                for (const batch of chunks(orphans, 100)) {
                    try {
                        await cloudinary.api.delete_resources(batch, { resource_type: "raw" });
                        console.log(`[CLEANUP] Deleted ${batch.length} orphan(s)`);
                    } catch (e) {
                        console.warn("[CLEANUP] Batch delete failed", e?.message || e);
                    }
                }
                if (next_cursor) console.log("[CLEANUP] More assets exist beyond first page; consider increasing pagination");
            } catch (e) {
                console.warn("[CLEANUP] Failed:", e?.message || e);
            }
        });
    } catch {}

    try {
        cron.schedule("*/5 * * * *", async () => {
            const result = await deliverDuePracticeReminders();
            if (result.sent) console.log(`[REMINDERS] Sent ${result.sent} reminder(s)`);
        });
        if (process.env.REMINDER_DELIVERY_ENABLED === "true") console.log("[REMINDERS] Delivery scheduler started");
    } catch (error) { console.warn("[REMINDERS] Scheduler failed", error?.message || error); }

    try {
        cron.schedule("* * * * *", async () => {
            try { const result = await processAssessmentLifecycle(); if (result.opened || result.closed || result.sent || result.failed) console.log(`[ASSESSMENTS] opened=${result.opened} closed=${result.closed} sent=${result.sent} failed=${result.failed}`); }
            catch (error) { console.warn("[ASSESSMENTS] Lifecycle processing failed", error?.message || error); }
        });
    } catch (error) { console.warn("[ASSESSMENTS] Lifecycle scheduler failed", error?.message || error); }

    try {
        cron.schedule("15 3 * * *", async () => {
            const assessments = await Assessment.find({ "integrity.enabled": true }).select("integrity.retentionDays").lean();
            for (const assessment of assessments) {
                const cutoff = new Date(Date.now() - (assessment.integrity?.retentionDays || 30) * 86400000);
                await CandidateAttempt.updateMany({ assessment: assessment._id }, { $pull: { integrityEvents: { at: { $lt: cutoff } } } });
            }
        });
    } catch (error) { console.warn("[INTEGRITY] Retention cleanup scheduler failed", error?.message || error); }

    // Start OTLP push if configured
    try { startOtlpPush(); } catch {}
});

// Graceful shutdown
const shutdown = async (signal) => {
    try { console.log(`[${signal}] shutting down...`); } catch {}
    try { server.close(() => {}); } catch {}
    try { await mongoose.connection.close().catch(() => {}); } catch {}
    try { const r = await getRedisClient(); if (r && r.isOpen) await r.quit(); } catch {}
    try { process.exit(0); } catch { process.exit(1); }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
