import AuditLog from "../models/AuditLog.js";

const audit = (action, { entityType, getEntityId, pickBody } = {}) => {
    return (req, res, next) => {
        const startedAt = Date.now();
        let responseBody;
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            responseBody = body;
            return originalJson(body);
        };
        res.once("finish", () => {
            try {
                const entityId = getEntityId
                    ? getEntityId(req, req.body || {}, responseBody)
                    : responseBody?._id || responseBody?.id;
                const metadata = pickBody ? pickBody(req.body || {}) : undefined;
                AuditLog.create({
                    user: req.user?._id,
                    action,
                    entityType,
                    entityId: entityId ? String(entityId) : undefined,
                    ip: req.ip,
                    userAgent: req.get("user-agent"),
                    requestId: req.id,
                    method: req.method,
                    path: req.originalUrl?.split("?")[0],
                    statusCode: res.statusCode,
                    outcome: res.statusCode >= 200 && res.statusCode < 400 ? "success" : "failure",
                    durationMs: Date.now() - startedAt,
                    metadata,
                }).catch(() => {});
            } catch {}
        });
        next();
    };
};

export default audit;
