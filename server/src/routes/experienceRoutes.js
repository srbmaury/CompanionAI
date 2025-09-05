import express from "express";
import protect from "../middleware/authMiddleware.js";
import { searchExperiences } from "../controllers/experienceController.js";

const router = express.Router();

/**
 * @openapi
 * /api/experiences/search:
 *   get:
 *     tags: [Experiences]
 *     summary: Search shared interview experiences by company and role
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: company
 *         schema: { type: string }
 *         required: true
 *       - in: query
 *         name: role
 *         schema: { type: string }
 *         required: true
 *     responses:
 *       200:
 *         description: List of results { title, url, snippet }
 */

router.get("/search", protect, searchExperiences);

export default router;
