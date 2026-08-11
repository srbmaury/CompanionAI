import getRedisClient from "../config/redis.js";
import metrics from "../metrics/index.js";

// quotas({ key, metricKey, windowSeconds, maxPerWindow })
// key: function(req) -> stable key per user/action, e.g., `user:${req.user._id}:run-code`
// metricKey: bounded action name. Never use the Redis key because it may contain identifiers.
const quotas = ({ key, metricKey = "unknown", windowSeconds, maxPerWindow }) => {
    return async (req, res, next) => {
        try {
            const client = await getRedisClient();
            if (!client) return next(); // best-effort; skip if no redis
            const now = Math.floor(Date.now() / 1000);
            const k = key(req);
            const bucket = Math.floor(now / windowSeconds);
            const redisKey = `quota:${k}:${bucket}`;
            const count = await client.incr(redisKey);
            if (count === 1) await client.expire(redisKey, windowSeconds + 5);
            if (count > maxPerWindow) {
                try { metrics.quotasDeniedTotal.labels(metricKey).inc(); } catch {}
                return res.status(429).json({ message: "Quota exceeded. Please try again later." });
            }
            return next();
        } catch {
            return next();
        }
    };
};

export default quotas;
