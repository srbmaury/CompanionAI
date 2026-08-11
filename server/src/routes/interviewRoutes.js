import express from "express";
import { createInterview, getInterviews, getInterview, getProgressSummary } from "../controllers/interviewController.js";
import protect from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";
import { z } from "zod";
import audit from "../middleware/audit.js";
import quotas from "../middleware/quotas.js";
import usageLimit from "../middleware/usageLimit.js";

const router = express.Router();

/**
 * @openapi
 * /api/interviews:
 *   post:
 *     tags: [Interviews]
 *     summary: Create interview with fully defined rounds
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Interview created
 *   get:
 *     tags: [Interviews]
 *     summary: List interviews for current user
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         required: false
 *         description: Page number (default 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         required: false
 *         description: Page size (default 10, max 100)
 *     responses:
 *       200:
 *         description: Array of interviews or a paginated object { items, total, page, limit, totalPages }
 *
 * /api/interviews/{id}:
 *   get:
 *     tags: [Interviews]
 *     summary: Get interview by id
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Interview
 */

// Validators
const RoundInput = z.object({
    roundName: z.string().min(2).max(60),
    description: z.string().min(4).max(220),
    deliveryMode: z.enum(["online-assessment", "conversational"]).optional(),
    questionLimit: z.coerce.number().int().min(1).max(20).optional(),
});

const CreateInterviewSchema = z.object({
    resumeId: z.string().min(1),
    company: z.string().max(120).optional().default(""),
    jobRole: z.string().min(1).max(120),
    jobDescription: z.string().min(1).max(4000),
    rounds: z.array(RoundInput).min(1).max(5),
}).transform((d) => ({
    ...d,
    company: d.company?.toString().trim(),
    jobRole: d.jobRole?.toString().trim(),
    jobDescription: d.jobDescription?.toString(),
}));

router.post(
    "/",
    protect,
    quotas({
        key: (req) => `user:${req.user?._id || "anon"}:interview:create`,
        windowSeconds: 60 * 60,
        maxPerWindow: Number(process.env.QUOTA_INTERVIEW_CREATE_PER_HOUR || 30),
    }),
    validate(CreateInterviewSchema),
    usageLimit("interviews", "interviewsPerMonth"),
    audit("interview.create", { entityType: "Interview" }),
    createInterview
);
router.get("/", protect, getInterviews);
router.get("/analytics/progress", protect, getProgressSummary);
router.get("/:id", protect, getInterview);

export default router;
