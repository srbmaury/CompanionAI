import express from "express";
import protect from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";
import { z } from "zod";
import { ObjectIdString } from "../validation/commonSchemas.js";
import audit from "../middleware/audit.js";
import { getQueue } from "../queues/index.js";
import quotas from "../middleware/quotas.js";

const router = express.Router();

const EnqueuePrepareSchema = z.object({
    interviewId: ObjectIdString,
    roundId: ObjectIdString,
    count: z.number().int().min(1).max(20).optional(),
    prefetch: z.boolean().optional(),
});

router.post(
    "/prepare-questions",
    protect,
    quotas({
        key: (req) => `user:${req.user?._id || "anon"}:job:prepare`,
        windowSeconds: 60 * 60,
        maxPerWindow: Number(process.env.QUOTA_JOB_PREPARE_PER_HOUR || 60),
    }),
    validate(EnqueuePrepareSchema),
    audit("job.prepare.enqueue", { entityType: "Round", getEntityId: (_req, body) => body.roundId, pickBody: (b) => ({ interviewId: b.interviewId, roundId: b.roundId, count: b.count }) }),
    async (req, res) => {
        try {
            const q = await getQueue("prepare-questions");
            if (!q) return res.status(503).json({ message: "Queue unavailable" });
            const { interviewId, roundId, count, prefetch } = req.body;
            const jobId = `prepare:${interviewId}:${roundId}:${count || ""}:${prefetch ? 1 : 0}`;
            const job = await q.add("prepare", req.body, { jobId, removeOnComplete: { age: 3600, count: 500 }, removeOnFail: { age: 86400, count: 500 } });
            return res.json({ jobId: job.id });
        } catch (e) {
            console.error("enqueue prepare error", e);
            return res.status(500).json({ message: "Failed to enqueue" });
        }
    }
);

const EnqueueFeedbackSchema = z.object({
    roundId: ObjectIdString,
    items: z.array(z.object({
        index: z.number().int().nonnegative(),
        questionId: ObjectIdString,
        answer: z.string().max(5000),
    })).min(1),
    attach: z.boolean().optional(),
});

router.post(
    "/bulk-feedback",
    protect,
    quotas({
        key: (req) => `user:${req.user?._id || "anon"}:job:bulk-feedback`,
        windowSeconds: 60 * 60,
        maxPerWindow: Number(process.env.QUOTA_JOB_BULK_FEEDBACK_PER_HOUR || 60),
    }),
    validate(EnqueueFeedbackSchema),
    audit("job.feedback.enqueue", { entityType: "Round", getEntityId: (_req, body) => body.roundId }),
    async (req, res) => {
        try {
            const q = await getQueue("bulk-feedback");
            if (!q) return res.status(503).json({ message: "Queue unavailable" });
            const { roundId, items } = req.body;
            const hash = Buffer.from(JSON.stringify(items || [])).toString("base64").slice(0, 40);
            const jobId = `feedback:${roundId}:${hash}`;
            const job = await q.add("bulk-feedback", req.body, { jobId, removeOnComplete: { age: 3600, count: 500 }, removeOnFail: { age: 86400, count: 500 } });
            return res.json({ jobId: job.id });
        } catch (e) {
            console.error("enqueue feedback error", e);
            return res.status(500).json({ message: "Failed to enqueue" });
        }
    }
);

router.get(
    "/status/:queue/:id",
    protect,
    validate(z.object({ queue: z.string().min(1), id: z.string().min(1) }), "params"),
    async (req, res) => {
        try {
            const q = await getQueue(req.params.queue);
            if (!q) return res.status(503).json({ message: "Queue unavailable" });
            const job = await q.getJob(req.params.id);
            if (!job) return res.status(404).json({ message: "Job not found" });
            const state = await job.getState();
            const progress = job.progress || 0;
            const returnvalue = job.returnvalue || null;
            const counts = await q.getJobCounts();
            return res.json({ state, progress, result: returnvalue, counts });
        } catch (e) {
            console.error("job status error", e);
            return res.status(500).json({ message: "Failed to get status" });
        }
    }
);

// List failed jobs (DLQ-like view)
router.get(
    "/failed/:queue",
    protect,
    validate(z.object({ queue: z.string().min(1) }), "params"),
    async (req, res) => {
        try {
            const q = await getQueue(req.params.queue);
            if (!q) return res.status(503).json({ message: "Queue unavailable" });
            const failed = await q.getFailed(0, 50);
            const items = failed.map((j) => ({ id: j.id, name: j.name, failedReason: j.failedReason, attemptsMade: j.attemptsMade, timestamp: j.timestamp }));
            return res.json({ items });
        } catch (e) {
            console.error("list failed jobs error", e);
            return res.status(500).json({ message: "Failed to list failed jobs" });
        }
    }
);

// Retry a failed job
router.post(
    "/retry/:queue/:id",
    protect,
    validate(z.object({ queue: z.string().min(1), id: z.string().min(1) }), "params"),
    async (req, res) => {
        try {
            const q = await getQueue(req.params.queue);
            if (!q) return res.status(503).json({ message: "Queue unavailable" });
            const job = await q.getJob(req.params.id);
            if (!job) return res.status(404).json({ message: "Job not found" });
            await job.retry();
            return res.json({ ok: true });
        } catch (e) {
            console.error("retry job error", e);
            return res.status(500).json({ message: "Failed to retry job" });
        }
    }
);

// Remove a job (failed or completed)
router.delete(
    "/remove/:queue/:id",
    protect,
    validate(z.object({ queue: z.string().min(1), id: z.string().min(1) }), "params"),
    async (req, res) => {
        try {
            const q = await getQueue(req.params.queue);
            if (!q) return res.status(503).json({ message: "Queue unavailable" });
            const job = await q.getJob(req.params.id);
            if (!job) return res.status(404).json({ message: "Job not found" });
            await job.remove();
            return res.json({ ok: true });
        } catch (e) {
            console.error("remove job error", e);
            return res.status(500).json({ message: "Failed to remove job" });
        }
    }
);

export default router;