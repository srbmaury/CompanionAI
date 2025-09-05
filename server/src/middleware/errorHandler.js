import metrics from "../metrics/index.js";

// Central error handler - keeps responses uniform and redacts sensitive data
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const requestId = req.id || undefined;
    const payload = {
        message: status === 500 ? "Internal server error" : err.message || "Error",
        requestId,
    };
    if (process.env.NODE_ENV !== "production") {
        payload.stack = err.stack;
    }
    // Log server-side with minimal PII
    try {
        console.error(JSON.stringify({ level: "error", requestId, status, message: err.message, stack: err.stack }));
        try { metrics.errorsTotal.labels(String(status), req.route?.path || req.path).inc(); } catch {}
    } catch {}
    // Optional: Sentry or other error tracking
    try {
        if (process.env.SENTRY_DSN && global.Sentry && typeof global.Sentry.captureException === "function") {
            global.Sentry.captureException(err, { tags: { requestId } });
        }
    } catch {}
    res.status(status).json(payload);
};

export default errorHandler;