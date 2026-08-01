import express from "express";
import protect from "../middleware/authMiddleware.js";
import requireRole from "../middleware/requireRole.js";
import validate from "../middleware/validate.js";
import { z } from "zod";
import AuditLog from "../models/AuditLog.js";
import ProductFeedback from "../models/ProductFeedback.js";
import audit from "../middleware/audit.js";
import { ObjectIdString } from "../validation/commonSchemas.js";

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

router.get(
    "/feedback",
    protect,
    requireRole("admin"),
    validate(z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        status: z.enum(["new", "reviewed", "closed"]).optional(),
        category: z.enum(["idea", "problem", "praise", "other"]).optional(),
        q: z.string().trim().max(200).optional(),
    }), "query"),
    async (req, res, next) => {
        try {
            const { page = 1, limit = 20, status, category, q } = req.query;
            const filter = {};
            if (status) filter.status = status;
            if (category) filter.category = category;
            if (q) filter.message = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
            const [total, items] = await Promise.all([
                ProductFeedback.countDocuments(filter),
                ProductFeedback.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate("user", "name email").lean(),
            ]);
            return res.json({ items, total, page, limit, totalPages: Math.max(Math.ceil(total / limit), 1) });
        } catch (error) { return next(error); }
    }
);

router.patch(
    "/feedback/:feedbackId",
    protect,
    requireRole("admin"),
    validate(z.object({ feedbackId: ObjectIdString }), "params"),
    validate(z.object({ status: z.enum(["new", "reviewed", "closed"]) })),
    audit("product_feedback.status_update", { entityType: "ProductFeedback", getEntityId: (req) => req.params.feedbackId, pickBody: (body) => ({ status: body.status }) }),
    async (req, res, next) => {
        try {
            const item = await ProductFeedback.findByIdAndUpdate(req.params.feedbackId, { $set: { status: req.body.status } }, { new: true }).populate("user", "name email");
            if (!item) return res.status(404).json({ message: "Feedback not found" });
            return res.json(item);
        } catch (error) { return next(error); }
    }
);

export default router;
