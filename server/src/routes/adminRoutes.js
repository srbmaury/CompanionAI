import express from "express";
import protect from "../middleware/authMiddleware.js";
import requireRole from "../middleware/requireRole.js";
import validate from "../middleware/validate.js";
import { z } from "zod";
import AuditLog from "../models/AuditLog.js";

const router = express.Router();

const QuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    user: z.string().optional(),
    action: z.string().optional(),
    entityType: z.string().optional(),
});

router.get(
    "/audit",
    protect,
    requireRole("admin"),
    validate(QuerySchema, "query"),
    async (req, res) => {
        const { page = 1, limit = 50, user, action, entityType } = req.query;
        const filter = {};
        if (user) filter.user = user;
        if (action) filter.action = action;
        if (entityType) filter.entityType = entityType;
        const total = await AuditLog.countDocuments(filter);
        const items = await AuditLog.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
        return res.json({ items, total, page, limit, totalPages: Math.max(Math.ceil(total / limit), 1) });
    }
);

export default router;