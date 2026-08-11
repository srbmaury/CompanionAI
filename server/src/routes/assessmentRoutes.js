import express from "express";
import { z } from "zod";
import protect from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";
import quotas from "../middleware/quotas.js";
import usageLimit from "../middleware/usageLimit.js";
import { ObjectIdString } from "../validation/commonSchemas.js";
import {
    createAssessment, getAssessmentReport, getPublicAssessment, listAssessments,
    generateAssessmentQuestions, improveAssessmentQuestionText, saveCandidateAnswer, startCandidateAttempt, submitCandidateAttempt, updateAssessment,
} from "../controllers/assessmentController.js";

const router = express.Router();
const questionInput = z.object({ text: z.string().trim().min(5).max(1000) });
const roundInput = z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().max(300).optional().default(""), aiPrompt: z.string().trim().max(1000).optional().default(""), questionCount: z.coerce.number().int().min(1).max(10), questions: z.array(questionInput).max(10).optional().default([]) });
const attemptParams = z.object({ shareToken: z.string().min(20).max(100), attemptId: ObjectIdString });

router.get("/public/:shareToken", validate(z.object({ shareToken: z.string().min(20).max(100) }), "params"), getPublicAssessment);
router.post("/public/:shareToken/start", quotas({ key: (req) => `assessment-start:${req.params.shareToken}:${req.ip}`, metricKey: "assessment_start", windowSeconds: 3600, maxPerWindow: 10 }), validate(z.object({ shareToken: z.string().min(20).max(100) }), "params"), validate(z.object({ name: z.string().trim().min(1).max(120), email: z.string().trim().email().max(254) })), startCandidateAttempt);
router.put("/public/:shareToken/attempts/:attemptId/answer", quotas({ key: (req) => `assessment-answer:${req.params.attemptId}:${req.ip}`, metricKey: "assessment_answer", windowSeconds: 3600, maxPerWindow: 60 }), validate(attemptParams, "params"), validate(z.object({ roundIndex: z.number().int().min(0).max(4), questionIndex: z.number().int().min(0).max(19), answer: z.string().max(5000).optional(), followUpAnswer: z.string().max(5000).optional() }).refine((body) => body.answer !== undefined || body.followUpAnswer !== undefined)), saveCandidateAnswer);
router.post("/public/:shareToken/attempts/:attemptId/submit", quotas({ key: (req) => `assessment-submit:${req.params.attemptId}:${req.ip}`, metricKey: "assessment_submit", windowSeconds: 3600, maxPerWindow: 5 }), validate(attemptParams, "params"), submitCandidateAttempt);

router.get("/", protect, listAssessments);
router.post("/questions/generate", protect, quotas({ key: (req) => `assessment-question-generate:${req.user._id}`, metricKey: "assessment_question_generate", windowSeconds: 3600, maxPerWindow: 30 }), validate(z.object({ company: z.string().trim().max(120).optional().default(""), jobRole: z.string().trim().min(2).max(120), jobDescription: z.string().trim().min(20).max(4000), roundName: z.string().trim().min(2).max(80), roundDescription: z.string().trim().max(300).optional().default(""), prompt: z.string().trim().min(3).max(1000), count: z.coerce.number().int().min(1).max(10), existingQuestions: z.array(z.string().trim().min(5).max(1000)).max(20).optional().default([]) })), generateAssessmentQuestions);
router.post("/questions/improve", protect, quotas({ key: (req) => `assessment-question-improve:${req.user._id}`, metricKey: "assessment_question_improve", windowSeconds: 3600, maxPerWindow: 60 }), validate(z.object({ question: z.string().trim().min(5).max(1000), instruction: z.string().trim().max(500).optional().default(""), jobRole: z.string().trim().max(120).optional().default(""), jobDescription: z.string().trim().max(4000).optional().default(""), roundName: z.string().trim().max(80).optional().default("") })), improveAssessmentQuestionText);
router.post("/", protect, usageLimit("assessments", "assessmentsPerMonth"), validate(z.object({ title: z.string().trim().min(2).max(160), company: z.string().trim().max(120).optional().default(""), jobRole: z.string().trim().min(2).max(120), jobDescription: z.string().trim().min(20).max(4000), followUpsEnabled: z.boolean().optional().default(true), candidateInstructions: z.string().trim().max(1200).optional().default(""), contactEmail: z.union([z.string().trim().email().max(254), z.literal("")]).optional().default(""), durationMinutes: z.coerce.number().int().min(5).max(240).optional().default(30), expiresAt: z.coerce.date().optional(), rounds: z.array(roundInput).min(1).max(5) })), createAssessment);
router.get("/:assessmentId", protect, validate(z.object({ assessmentId: ObjectIdString }), "params"), getAssessmentReport);
router.patch("/:assessmentId", protect, validate(z.object({ assessmentId: ObjectIdString }), "params"), validate(z.object({ status: z.enum(["active", "closed"]) })), updateAssessment);

export default router;
