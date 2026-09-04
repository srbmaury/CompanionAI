import bullmqPkg from "bullmq";
const { Queue, Worker, QueueScheduler } = bullmqPkg;
import getRedisClient from "../config/redis.js";
import metrics from "../metrics/index.js";
import productionMetrics from "../metrics/production.js";

let connection = null;
let queues = new Map();
let schedulers = new Map();

export const getConnection = async () => {
    if (connection) return connection;
    const redis = await getRedisClient();
    if (!redis) return null;
    // bullmq expects ioredis-like options; use node-redis connection via socket
    // Fallback to URL when available
    const url = process.env.REDIS_URL;
    if (!url) return null;
    try {
        const u = new URL(url);
        const isTls = u.protocol === "rediss:";
        const db = Number((u.pathname || "").replace("/", "")) || 0;
        const connectTimeout = Math.max(parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS || "15000", 10) || 15000, 1000);
        const retryBase = Math.max(parseInt(process.env.REDIS_RETRY_BASE_MS || "500", 10) || 500, 100);
        const retryMax = Math.max(parseInt(process.env.REDIS_RETRY_MAX_MS || "30000", 10) || 30000, 1000);
        connection = {
            host: u.hostname,
            port: Number(u.port || (isTls ? 6380 : 6379)),
            username: u.username || undefined,
            password: u.password || undefined,
            db,
            tls: isTls ? {} : undefined,
            connectTimeout,
            retryStrategy: (times) => Math.min(retryMax, retryBase * Math.pow(2, times)),
            enableReadyCheck: true,
            maxRetriesPerRequest: null,
            showFriendlyErrorStack: process.env.NODE_ENV !== "production",
        };
    } catch (_e) {
        // fallback to simple URL config
        connection = { url };
    }
    return connection;
};

export const getQueue = async (name) => {
    const conn = await getConnection();
    if (!conn) return null;
    if (queues.has(name)) return queues.get(name);
    const defaultTimeout = Math.max(parseInt(process.env.QUEUE_JOB_TIMEOUT_MS || "60000", 10) || 60000, 1000);
    const q = new Queue(name, {
        connection: conn,
        defaultJobOptions: {
            attempts: 3,
            backoff: { type: "exponential", delay: 500 },
            timeout: defaultTimeout,
        },
    });
    queues.set(name, q);
    const refreshDepth = async () => {
        try {
            const counts = await q.getJobCounts("waiting", "active", "delayed", "failed", "completed");
            for (const [state, count] of Object.entries(counts)) metrics.queueDepth.labels(name, state).set(count);

            const [oldestWaiting] = await q.getWaiting(0, 0);
            const ageSeconds = oldestWaiting?.timestamp
                ? Math.max(0, (Date.now() - Number(oldestWaiting.timestamp)) / 1000)
                : 0;
            productionMetrics.queueOldestWaitingJobAgeSeconds.labels(name).set(ageSeconds);
        } catch {}
    };
    refreshDepth();
    const depthTimer = setInterval(refreshDepth, 30000);
    depthTimer.unref?.();
    if (!schedulers.has(name)) {
        try {
            const sch = new QueueScheduler(name, { connection: conn });
            schedulers.set(name, sch);
        } catch {}
    }
    return q;
};

export const createWorker = async (name, processor) => {
    const conn = await getConnection();
    if (!conn) return null;
    const concurrency = Math.max(parseInt(process.env.WORKER_CONCURRENCY || "1", 10) || 1, 1);
    const worker = new Worker(name, processor, { connection: conn, concurrency });
    const activeJobs = new Set();

    const markActive = (job) => {
        const id = job?.id == null ? "" : String(job.id);
        if (id && !activeJobs.has(id)) {
            activeJobs.add(id);
            productionMetrics.queueJobsInFlight.labels(name).inc();
        }
    };
    const markInactive = (jobOrId) => {
        const id = typeof jobOrId === "object" ? jobOrId?.id : jobOrId;
        const key = id == null ? "" : String(id);
        if (key && activeJobs.delete(key)) productionMetrics.queueJobsInFlight.labels(name).dec();
    };

    worker.on("active", (job) => {
        markActive(job);
        if (Number(job?.attemptsMade || 0) === 0 && job?.timestamp) {
            const startedAt = Number(job.processedOn || Date.now());
            productionMetrics.queueWaitDurationSeconds.labels(name).observe(Math.max(0, startedAt - Number(job.timestamp)) / 1000);
        }
    });
    worker.on("completed", (job) => {
        markInactive(job);
        metrics.queueJobsTotal.labels(name, "completed").inc();
        if (job?.processedOn && job?.finishedOn) metrics.queueJobDurationSeconds.labels(name, "completed").observe(Math.max(0, job.finishedOn - job.processedOn) / 1000);
    });
    worker.on("failed", (job, err) => {
        markInactive(job);
        const retrying = Number(job?.attemptsMade || 0) < Number(job?.opts?.attempts || 1);
        metrics.queueJobsTotal.labels(name, retrying ? "failed_retryable" : "dead_letter").inc();
        if (retrying) metrics.queueRetriesTotal.labels(name).inc();
        if (job?.processedOn) metrics.queueJobDurationSeconds.labels(name, "failed").observe(Math.max(0, Date.now() - job.processedOn) / 1000);
        console.warn(`[worker:${name}] job ${job?.id} failed:`, err?.message || err);
    });
    worker.on("stalled", (jobId) => {
        markInactive(jobId);
    });
    worker.on("error", (err) => {
        console.warn(`[worker:${name}] error:`, err?.message || err);
    });
    return worker;
};

export default { getQueue, createWorker };
