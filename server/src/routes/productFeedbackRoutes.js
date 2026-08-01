import express from "express";
import { z } from "zod";
import protect from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";
import ProductFeedback from "../models/ProductFeedback.js";

const router = express.Router();
const schema = z.object({
    category: z.enum(["idea", "problem", "praise", "other"]),
    message: z.string().trim().min(3).max(2000),
    page: z.string().trim().max(300).optional(),
});

router.post("/", protect, validate(schema), async (req, res, next) => {
    try {
        const feedback = await ProductFeedback.create({ ...req.body, user: req.user._id });
        return res.status(201).json({ _id: feedback._id, message: "Feedback received" });
    } catch (error) {
        return next(error);
    }
});

export default router;
