import express from "express";
import protect from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";
import { z } from "zod";
import { createFeedback, attachFeedbackToRoundQuestion, getFeedbackForQuestion, createBulkFeedback } from "../controllers/feedbackController.js";

const router = express.Router();

/**
 * @openapi
 * /api/feedback/bulk:
 *   post:
 *     tags: [Feedback]
 *     summary: Bulk create feedback for OA answers
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     questionId:
 *                       type: string
 *                     answer:
 *                       type: string
 *     responses:
 *       200:
 *         description: Feedback created
 *
 * /api/feedback/{questionId}:
 *   post:
 *     tags: [Feedback]
 *     summary: Create feedback for a question
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         schema:
 *           type: string
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               answer:
 *                 type: string
 *     responses:
 *       200:
 *         description: Feedback created
 *   get:
 *     tags: [Feedback]
 *     summary: Get feedback for a question
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Feedback
 *
 * /api/feedback/attach/{roundId}:
 *   post:
 *     tags: [Feedback]
 *     summary: Attach feedback to a round question index
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: roundId
 *         schema:
 *           type: string
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               index:
 *                 type: integer
 *               feedbackId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Attached
 */
// Bulk create feedback for OA: items: [{ questionId, answer }]
router.post(
    "/bulk",
    protect,
    validate(z.object({ items: z.array(z.object({ questionId: z.string().min(1), answer: z.string().min(1).max(5000) })).min(1) })),
    createBulkFeedback
);

router.post(
    "/:questionId",
    protect,
    validate(z.object({ answer: z.string().min(1).max(5000) })),
    createFeedback
);

router.get(
    "/:questionId",
    protect,
    getFeedbackForQuestion
);

router.post(
    "/attach/:roundId",
    protect,
    validate(z.object({ index: z.number().int().min(0), feedbackId: z.string().min(1) })),
    attachFeedbackToRoundQuestion
);

export default router;