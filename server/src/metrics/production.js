import client from "prom-client";

export const queueWaitDurationSeconds = new client.Histogram({
    name: "queue_wait_duration_seconds",
    help: "Time a queued job waits before a worker starts processing it",
    labelNames: ["queue"],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600],
});

export const queueOldestWaitingJobAgeSeconds = new client.Gauge({
    name: "queue_oldest_waiting_job_age_seconds",
    help: "Age of the oldest waiting job in a queue",
    labelNames: ["queue"],
});

export const queueJobsInFlight = new client.Gauge({
    name: "queue_jobs_in_flight",
    help: "Jobs currently executing in workers",
    labelNames: ["queue"],
});

export const assessmentEvaluationDurationSeconds = new client.Histogram({
    name: "assessment_evaluation_duration_seconds",
    help: "End-to-end time from candidate submission entering evaluation until a terminal evaluation outcome",
    labelNames: ["outcome"],
    buckets: [1, 2, 5, 10, 20, 30, 60, 120, 300, 600, 1200],
});

export const assessmentEvaluationsInFlight = new client.Gauge({
    name: "assessment_evaluations_in_flight",
    help: "Candidate assessment evaluations currently executing",
});

export const mongoPoolConnections = new client.Gauge({
    name: "mongo_pool_connections",
    help: "Application MongoDB pool connections by state",
    labelNames: ["state"],
});

export const mongoPoolWaitQueue = new client.Gauge({
    name: "mongo_pool_wait_queue",
    help: "MongoDB connection checkout requests currently waiting",
});

export const mongoPoolCheckoutFailuresTotal = new client.Counter({
    name: "mongo_pool_checkout_failures_total",
    help: "MongoDB connection pool checkout failures",
});

export const redisPingDurationSeconds = new client.Histogram({
    name: "redis_ping_duration_seconds",
    help: "Redis health-check ping latency",
    labelNames: ["outcome"],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

export const redisReconnectsTotal = new client.Counter({
    name: "redis_reconnects_total",
    help: "Redis reconnect attempts observed by the application",
});

export const redisConnectionReady = new client.Gauge({
    name: "redis_connection_ready",
    help: "Whether the application Redis client is ready",
});

export const aiTokensByPurposeTotal = new client.Counter({
    name: "ai_tokens_by_purpose_total",
    help: "AI provider tokens grouped by stable product purpose",
    labelNames: ["provider", "model", "purpose", "type"],
});

export default {
    queueWaitDurationSeconds,
    queueOldestWaitingJobAgeSeconds,
    queueJobsInFlight,
    assessmentEvaluationDurationSeconds,
    assessmentEvaluationsInFlight,
    mongoPoolConnections,
    mongoPoolWaitQueue,
    mongoPoolCheckoutFailuresTotal,
    redisPingDurationSeconds,
    redisReconnectsTotal,
    redisConnectionReady,
    aiTokensByPurposeTotal,
};
