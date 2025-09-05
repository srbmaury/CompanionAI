import AuditLog from "../models/AuditLog.js";

const audit = (action, { entityType, getEntityId, pickBody } = {}) => {
    return async (req, res, next) => {
        try {
            await next();
        } finally {
            try {
                const entityId = getEntityId ? getEntityId(req) : undefined;
                const metadata = pickBody ? pickBody(req.body || {}) : undefined;
                await AuditLog.create({
                    user: req.user?._id,
                    action,
                    entityType,
                    entityId,
                    ip: req.ip,
                    userAgent: req.get("user-agent"),
                    requestId: req.id,
                    metadata,
                });
            } catch {}
        }
    };
};

export default audit;