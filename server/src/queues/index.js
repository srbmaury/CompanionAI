import bullmqPkg from "bullmq";
const { Queue, Worker, QueueScheduler } = bullmqPkg;
import getRedisClient from "../config/redis.js";

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
    worker.on("failed", (job, err) => {
        console.warn(`[worker:${name}] job ${job?.id} failed:`, err?.message || err);
    });
    worker.on("error", (err) => {
        console.warn(`[worker:${name}] error:`, err?.message || err);
    });
    return worker;
};

export default { getQueue, createWorker };
