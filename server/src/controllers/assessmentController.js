import crypto from "crypto";
import Assessment from "../models/Assessment.js";
import CandidateAttempt from "../models/CandidateAttempt.js";
import { generateQuestionsForRound, improveAssessmentQuestion } from "../utils/generateQuestions.js";
import { generateFollowUp } from "../utils/generateQuestions/followUp.js";
import metrics from "../metrics/index.js";
import runCode from "../utils/runCode.js";
import { transcribe } from "./sttController.js";
import { getQueue } from "../queues/index.js";
import { createJobId } from "../queues/jobIds.js";
import candidateAssessmentProcessor from "../queues/workers/candidateAssessment.js";

const tokenHash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const followupLabel = (assessment) => assessment == null ? "unknown" : assessment.followUpsEnabled ? "enabled" : "disabled";
const observeCandidateAction = (action, outcome, assessment) => { try { metrics.candidateAssessmentActionsTotal.labels(action, outcome, followupLabel(assessment)).inc(); } catch {} };
const publicAssessment = (assessment) => ({
    title: assessment.title,
    company: assessment.company,
    jobRole: assessment.jobRole,
    candidateInstructions: assessment.candidateInstructions,
    contactEmail: assessment.contactEmail,
    durationMinutes: assessment.durationMinutes,
    followUpsEnabled: assessment.followUpsEnabled,
    expiresAt: assessment.expiresAt,
    capabilities: {
        codeExecution: process.env.ENABLE_CODE_EXEC === "true",
        transcription: process.env.ENABLE_STT === "true",
    },
    rounds: assessment.rounds.map((round) => ({ name: round.name, description: round.description, deliveryMode: round.deliveryMode || "conversational", questionCount: round.questions.length })),
});
const publicAttempt = (attempt) => ({
    _id: attempt._id,
    candidateName: attempt.candidateName,
    status: attempt.status,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    rounds: attempt.rounds.map((round) => ({
        _id: round._id,
        name: round.name,
        description: round.description,
        deliveryMode: round.deliveryMode || "conversational",
        questions: round.questions.map((question) => ({
            _id: question._id,
            text: question.text,
            answer: question.answer,
            spokenExplanation: question.spokenExplanation,
            followUpQuestion: question.followUpQuestion,
            followUpAnswer: question.followUpAnswer,
        })),
    })),
});
const findPublicAssessment = (shareToken) => Assessment.findOne({ shareToken, status: "active", $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] });
const findAttempt = async (assessmentId, attemptId, rawToken) => {
    if (!rawToken) return null;
    return CandidateAttempt.findOne({ _id: attemptId, assessment: assessmentId, accessTokenHash: tokenHash(rawToken) }).select("+accessTokenHash");
};

const authorizeCandidateTool = async (req, res) => {
    const assessment = await findPublicAssessment(req.params.shareToken);
    if (!assessment) { res.status(404).json({ message: "Assessment unavailable" }); return null; }
    const attempt = await findAttempt(assessment._id, req.params.attemptId, req.get("x-attempt-token"));
    if (!attempt || attempt.status !== "started") { res.status(401).json({ message: "Attempt unavailable" }); return null; }
    return attempt;
};

export const protectCandidateTool = async (req, res, next) => {
    try {
        const attempt = await authorizeCandidateTool(req, res);
        if (!attempt) return;
        req.candidateAttempt = attempt;
        return next();
    } catch (error) { return next(error); }
};

export const runCandidateCode = async (req, res, next) => {
    try {
        if (!req.candidateAttempt && !await authorizeCandidateTool(req, res)) return;
        return runCode(req, res);
    } catch (error) { return next(error); }
};

export const transcribeCandidateAudio = async (req, res, next) => {
    try {
        if (!req.candidateAttempt && !await authorizeCandidateTool(req, res)) return;
        return transcribe(req, res, next);
    } catch (error) { return next(error); }
};

export const createAssessment = async (req, res, next) => {
    try {
        const { title, company = "", jobRole, jobDescription, followUpsEnabled = true, candidateInstructions = "", contactEmail = "", durationMinutes = 30, expiresAt, rounds } = req.body;
        const generatedRounds = [];
        const excludeTexts = [];
        for (const input of rounds) {
            const count = Math.min(Math.max(Number(input.questionCount) || 3, 1), 10);
            const manualTexts = (input.questions || []).map((item) => typeof item === "string" ? item : item?.text).map((item) => (item || "").toString().trim()).filter(Boolean).slice(0, count);
            let generated = [];
            if (manualTexts.length < count) try {
                generated = await generateQuestionsForRound({
                    company, jobRole, jobDescription, resumeText: "", roundName: input.name,
                    roundDescription: [input.description, input.aiPrompt ? `Interviewer generation request: ${input.aiPrompt}` : ""].filter(Boolean).join("\n"),
                    deliveryMode: input.deliveryMode || "conversational", count: count - manualTexts.length, excludeTexts: [...excludeTexts, ...manualTexts],
                });
            } catch { /* use deterministic fallback below */ }
            const texts = [...manualTexts, ...(Array.isArray(generated) ? generated : []).map((item) => typeof item === "string" ? item : item?.text).map((item) => (item || "").toString().trim()).filter(Boolean)].slice(0, count);
            while (texts.length < count) texts.push(`Describe how you would approach ${input.name} challenge ${texts.length + 1} for a ${jobRole}.`);
            excludeTexts.push(...texts);
            generatedRounds.push({ name: input.name, description: input.description || "", deliveryMode: input.deliveryMode || "conversational", questions: texts.map((text) => ({ text })) });
        }
        const assessment = await Assessment.create({
            owner: req.user._id, title, company, jobRole, jobDescription, followUpsEnabled,
            candidateInstructions, contactEmail, durationMinutes, expiresAt: expiresAt || undefined, rounds: generatedRounds,
            shareToken: crypto.randomBytes(24).toString("base64url"),
        });
        try { metrics.assessmentsTotal.labels("create", "success").inc(); metrics.assessmentQuestions.observe(generatedRounds.reduce((sum, round) => sum + round.questions.length, 0)); } catch {}
        return res.status(201).json(assessment);
    } catch (error) { try { metrics.assessmentsTotal.labels("create", "failure").inc(); } catch {} return next(error); }
};

export const generateAssessmentQuestions = async (req, res, next) => {
    try {
        const { company = "", jobRole, jobDescription, roundName, roundDescription = "", prompt = "", count = 5, existingQuestions = [] } = req.body;
        const questions = await generateQuestionsForRound({
            company, jobRole, jobDescription, resumeText: "", roundName,
            roundDescription: [roundDescription, prompt ? `Interviewer generation request: ${prompt}` : ""].filter(Boolean).join("\n"),
            deliveryMode: "online-assessment", count, excludeTexts: existingQuestions,
        });
        const texts = (questions || []).map((item) => typeof item === "string" ? item : item?.text).map((text) => (text || "").trim()).filter(Boolean).slice(0, count);
        if (!texts.length) return res.status(503).json({ message: "AI question generation is temporarily unavailable. You can still add questions manually." });
        try { metrics.assessmentsTotal.labels("question_generate", "success").inc(); } catch {}
        return res.json({ questions: texts.map((text) => ({ text })) });
    } catch (error) { try { metrics.assessmentsTotal.labels("question_generate", "failure").inc(); } catch {} return next(error); }
};

export const improveAssessmentQuestionText = async (req, res, next) => {
    try {
        const text = await improveAssessmentQuestion(req.body);
        try { metrics.assessmentsTotal.labels("question_improve", "success").inc(); } catch {}
        return res.json({ text });
    } catch (error) { try { metrics.assessmentsTotal.labels("question_improve", "failure").inc(); } catch {} return next(error); }
};

export const listAssessments = async (req, res, next) => {
    try {
        const page = Math.max(Number(req.query.page) || 1, 1); const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
        const filter = { owner: req.user._id };
        const [total, items] = await Promise.all([
            Assessment.countDocuments(filter),
            Assessment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        ]);
        const ids = items.map((item) => item._id);
        const counts = await CandidateAttempt.aggregate([{ $match: { assessment: { $in: ids } } }, { $group: { _id: "$assessment", total: { $sum: 1 }, submitted: { $sum: { $cond: [{ $eq: ["$status", "submitted"] }, 1, 0] } } } }]);
        const byId = new Map(counts.map((item) => [String(item._id), item]));
        return res.json({ items: items.map((item) => ({ ...item, attemptCount: byId.get(String(item._id))?.total || 0, submittedCount: byId.get(String(item._id))?.submitted || 0 })), total, page, totalPages: Math.max(Math.ceil(total / limit), 1) });
    } catch (error) { return next(error); }
};

export const getHiringOverview = async (req, res, next) => {
    try {
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
        const search = (req.query.search || "").toString().trim().slice(0, 100);
        const status = ["started", "evaluating", "submitted", "evaluation_failed"].includes(req.query.status) ? req.query.status : "";
        const assessments = await Assessment.find({ owner: req.user._id }).select("title company jobRole status expiresAt createdAt").sort({ createdAt: -1 }).lean();
        const assessmentIds = assessments.map((item) => item._id);
        const assessmentById = new Map(assessments.map((item) => [String(item._id), item]));
        const requestedAssessmentId = req.query.assessmentId;
        const selectedAssessmentId = assessmentById.has(String(requestedAssessmentId || "")) ? requestedAssessmentId : null;
        const attemptFilter = {
            assessment: requestedAssessmentId
                ? (selectedAssessmentId || { $in: [] })
                : { $in: assessmentIds },
        };
        if (status) attemptFilter.status = status;
        if (search) {
            const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            attemptFilter.$or = [{ candidateName: new RegExp(escaped, "i") }, { candidateEmail: new RegExp(escaped, "i") }];
        }
        const allAttemptsFilter = { assessment: { $in: assessmentIds } };
        const [totalCandidates, submitted, inProgress, scoreSummary, filteredTotal, attempts] = await Promise.all([
            CandidateAttempt.countDocuments(allAttemptsFilter),
            CandidateAttempt.countDocuments({ ...allAttemptsFilter, status: "submitted" }),
            CandidateAttempt.countDocuments({ ...allAttemptsFilter, status: { $in: ["started", "evaluating", "evaluation_failed"] } }),
            CandidateAttempt.aggregate([{ $match: { ...allAttemptsFilter, status: "submitted", overallScore: { $type: "number" } } }, { $group: { _id: null, average: { $avg: "$overallScore" } } }]),
            CandidateAttempt.countDocuments(attemptFilter),
            CandidateAttempt.find(attemptFilter).select("assessment candidateName candidateEmail status startedAt submittedAt overallScore updatedAt").sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        ]);
        return res.json({
            summary: {
                assessments: assessments.length,
                activeAssessments: assessments.filter((item) => item.status === "active").length,
                totalCandidates, submitted, inProgress,
                averageScore: scoreSummary[0]?.average == null ? null : Math.round(scoreSummary[0].average * 10) / 10,
            },
            assessments,
            candidates: attempts.map((attempt) => ({ ...attempt, assessment: assessmentById.get(String(attempt.assessment)) || null })),
            total: filteredTotal, page, totalPages: Math.max(Math.ceil(filteredTotal / limit), 1),
        });
    } catch (error) { return next(error); }
};

export const getAssessmentReport = async (req, res, next) => {
    try {
        const assessment = await Assessment.findOne({ _id: req.params.assessmentId, owner: req.user._id }).lean();
        if (!assessment) return res.status(404).json({ message: "Assessment not found" });
        const attempts = await CandidateAttempt.find({ assessment: assessment._id }).sort({ createdAt: -1 }).lean();
        try { metrics.assessmentReportsViewedTotal.labels(attempts.some((attempt) => attempt.status === "submitted") ? "yes" : "no").inc(); } catch {}
        return res.json({ assessment, attempts });
    } catch (error) { return next(error); }
};

export const updateAssessment = async (req, res, next) => {
    try {
        const assessment = await Assessment.findOneAndUpdate({ _id: req.params.assessmentId, owner: req.user._id }, { $set: { status: req.body.status } }, { new: true });
        if (!assessment) return res.status(404).json({ message: "Assessment not found" });
        try { metrics.assessmentsTotal.labels("status_update", "success").inc(); } catch {}
        return res.json(assessment);
    } catch (error) { try { metrics.assessmentsTotal.labels("status_update", "failure").inc(); } catch {} return next(error); }
};

export const getPublicAssessment = async (req, res, next) => {
    try {
        const assessment = await findPublicAssessment(req.params.shareToken).lean();
        if (!assessment) { observeCandidateAction("view", "unavailable", null); return res.status(404).json({ message: "Assessment unavailable" }); }
        observeCandidateAction("view", "success", assessment);
        return res.json(publicAssessment(assessment));
    } catch (error) { return next(error); }
};

export const startCandidateAttempt = async (req, res, next) => {
    try {
        const assessment = await findPublicAssessment(req.params.shareToken);
        if (!assessment) { observeCandidateAction("start", "unavailable", null); return res.status(404).json({ message: "Assessment unavailable" }); }
        const candidateEmail = req.body.email.toLowerCase().trim();
        const existing = await CandidateAttempt.findOne({ assessment: assessment._id, candidateEmail });
        if (existing) { observeCandidateAction("start", "duplicate", assessment); return res.status(409).json({ message: existing.status === "submitted" ? "This email has already submitted an attempt" : "An attempt for this email is already in progress. Continue from the browser where it was started or contact the interviewer." }); }
        const rawToken = crypto.randomBytes(32).toString("base64url");
        const rounds = assessment.rounds.map((round) => ({ name: round.name, description: round.description, deliveryMode: round.deliveryMode || "conversational", questions: round.questions.map((question) => ({ text: question.text })) }));
        const attempt = new CandidateAttempt({ assessment: assessment._id, candidateEmail });
        attempt.candidateName = req.body.name.trim(); attempt.accessTokenHash = tokenHash(rawToken); attempt.rounds = rounds; attempt.status = "started"; attempt.startedAt = new Date();
        await attempt.save();
        observeCandidateAction("start", "success", assessment);
        return res.status(201).json({ attemptToken: rawToken, attempt: publicAttempt(attempt) });
    } catch (error) { observeCandidateAction("start", "failure", null); return next(error); }
};

export const saveCandidateAnswer = async (req, res, next) => {
    try {
        const assessment = await findPublicAssessment(req.params.shareToken);
        if (!assessment) { observeCandidateAction("answer", "unavailable", null); return res.status(404).json({ message: "Assessment unavailable" }); }
        const attempt = await findAttempt(assessment._id, req.params.attemptId, req.get("x-attempt-token"));
        if (!attempt || attempt.status !== "started") { observeCandidateAction("answer", "unauthorized", assessment); return res.status(401).json({ message: "Attempt unavailable" }); }
        const { roundIndex, questionIndex, answer, spokenExplanation, followUpAnswer } = req.body;
        const item = attempt.rounds?.[roundIndex]?.questions?.[questionIndex];
        if (!item) { observeCandidateAction("answer", "invalid_question", assessment); return res.status(400).json({ message: "Invalid question" }); }
        if (answer !== undefined) item.answer = answer.toString().trim().slice(0, 20000);
        if (spokenExplanation !== undefined) item.spokenExplanation = spokenExplanation.toString().trim().slice(0, 5000);
        if (followUpAnswer !== undefined) item.followUpAnswer = followUpAnswer.toString().trim().slice(0, 5000);
        if (assessment.followUpsEnabled && item.answer && !item.followUpQuestion) {
            try {
                item.followUpQuestion = await generateFollowUp({ questionText: item.text, userAnswer: item.answer, jobRole: assessment.jobRole, roundName: attempt.rounds[roundIndex].name }) || "";
            } catch { /* The original answer remains valid when the AI provider is unavailable. */ }
        }
        await attempt.save();
        observeCandidateAction("answer", "success", assessment);
        return res.json({ attempt: publicAttempt(attempt) });
    } catch (error) { observeCandidateAction("answer", "failure", null); return next(error); }
};

export const submitCandidateAttempt = async (req, res, next) => {
    try {
        const assessment = await findPublicAssessment(req.params.shareToken);
        if (!assessment) { observeCandidateAction("submit", "unavailable", null); return res.status(404).json({ message: "Assessment unavailable" }); }
        const authorized = await findAttempt(assessment._id, req.params.attemptId, req.get("x-attempt-token"));
        if (!authorized) { observeCandidateAction("submit", "unauthorized", assessment); return res.status(401).json({ message: "Attempt unavailable" }); }
        if (authorized.status === "evaluating") return res.status(202).json({ submitted: true, status: "evaluating", message: "Your assessment is being evaluated." });
        if (authorized.status === "submitted") return res.json({ submitted: true, status: "submitted", message: "Your assessment has already been submitted." });
        if (authorized.status !== "started" && authorized.status !== "evaluation_failed") return res.status(409).json({ message: "Attempt cannot be submitted" });
        const attempt = authorized;
        const unanswered = attempt.rounds.flatMap((round) => round.questions).some((item) => !item.answer || (item.followUpQuestion && !item.followUpAnswer));
        if (unanswered) { observeCandidateAction("submit", "incomplete", assessment); return res.status(400).json({ message: "Answer every question and follow-up before submitting" }); }
        const evaluationStartedAt = new Date();
        const claimed = await CandidateAttempt.findOneAndUpdate({ _id: attempt._id, status: { $in: ["started", "evaluation_failed"] } }, { $set: { status: "evaluating", evaluationError: "", evaluationStartedAt } }, { new: true });
        if (!claimed) return res.status(202).json({ submitted: true, status: "evaluating", message: "Your assessment is already being evaluated." });
        if (process.env.NODE_ENV === "test") {
            await candidateAssessmentProcessor({ data: { attemptId: String(attempt._id) }, updateProgress: () => {} });
            return res.json({ submitted: true, status: "submitted", message: "Your assessment has been submitted to the interviewer." });
        }
        const queue = await getQueue("candidate-assessment");
        if (!queue) {
            await CandidateAttempt.updateOne({ _id: attempt._id, status: "evaluating" }, { $set: { status: "evaluation_failed", evaluationError: "Evaluation service unavailable" } });
            return res.status(503).json({ message: "Evaluation is temporarily unavailable. Please try again." });
        }
        const jobId = createJobId("candidate-assessment", { attemptId: String(attempt._id), evaluationStartedAt: claimed.evaluationStartedAt.toISOString() });
        await queue.add("evaluate", { attemptId: String(attempt._id) }, { jobId, removeOnComplete: { age: 86400, count: 1000 }, removeOnFail: { age: 604800, count: 1000 } });
        observeCandidateAction("submit", "accepted", assessment);
        return res.status(202).json({ submitted: true, status: "evaluating", message: "Your assessment was submitted and is being evaluated." });
    } catch (error) { observeCandidateAction("submit", "failure", null); return next(error); }
};
