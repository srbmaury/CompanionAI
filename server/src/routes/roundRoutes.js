import express from "express";
import { createRound, getSuggestedRounds } from "../controllers/roundController.js";
import protect from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";
import { z } from "zod";
import { ObjectIdString } from "../validation/commonSchemas.js";

const router = express.Router();

router.post(
    "/suggest",
    protect,
    validate(z.object({
        company: z.string().max(120).optional().default(""),
        jobRole: z.string().min(1).max(120),
        jobDescription: z.string().min(1).max(5000),
        resumeId: ObjectIdString.optional(),
    })),
    getSuggestedRounds
);

router.post(
    "/",
    protect,
    validate(z.object({
        roundName: z.string().min(2).max(60),
        description: z.string().min(4).max(260),
        deliveryMode: z.enum(["online-assessment", "conversational"]).optional(),
    })),
    createRound
);

export default router;
