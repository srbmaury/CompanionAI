import express from "express";
import protect from "../middleware/authMiddleware.js";
import { deleteSavedExperience, getSavedExperiences, saveExperience, searchExperiences } from "../controllers/experienceController.js";
import validate from "../middleware/validate.js";
import { z } from "zod";
import { ObjectIdString } from "../validation/commonSchemas.js";

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
router.get("/saved", protect, validate(z.object({ page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(50).optional() }), "query"), getSavedExperiences);
router.post("/saved", protect, validate(z.object({
    title: z.string().min(1).max(200), url: z.string().url().max(2000), snippet: z.string().max(1000).optional(),
    company: z.string().min(1).max(120), role: z.string().min(1).max(120),
})), saveExperience);
router.delete("/saved/:id", protect, validate(z.object({ id: ObjectIdString }), "params"), deleteSavedExperience);

export default router;
