import express from "express";
import { createRound, getSuggestedRounds } from "../controllers/roundController.js";
import protect from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";
import { z } from "zod";

const router = express.Router();

/**
 * @openapi
 * /api/rounds/suggest:
 *   post:
 *     tags: [Rounds]
 *     summary: Suggest interview rounds from JD using AI
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Suggested rounds
 *
 * /api/rounds:
 *   post:
 *     tags: [Rounds]
 *     summary: Create a round manually
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
 *         description: Round created
 */

// Suggest rounds using Gemini
router.post(
    "/suggest",
    protect,
    validate(
        z.object({
            company: z.string().min(1).max(120),
            jobRole: z.string().min(1).max(120),
            jobDescription: z.string().min(1).max(4000),
        })
    ),
    getSuggestedRounds
);

// Create one round manually
router.post(
    "/",
    protect,
    validate(
        z.object({
            roundName: z.string().min(2).max(60),
            description: z.string().min(4).max(220),
            deliveryMode: z.enum(["online-assessment", "conversational"]).optional(),
        })
    ),
    createRound
);

export default router;
