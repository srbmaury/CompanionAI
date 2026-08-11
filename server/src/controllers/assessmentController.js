import crypto from "crypto";
import Assessment from "../models/Assessment.js";
import CandidateAttempt from "../models/CandidateAttempt.js";
import { generateQuestionsForRound, improveAssessmentQuestion } from "../utils/generateQuestions.js";
import { generateFollowUp } from "../utils/generateQuestions/followUp.js";
import { generateFeedbackForAnswer } from "../utils/generateFeedback.js";
import metrics from "../metrics/index.js";

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
    rounds: assessment.rounds.map((round) => ({ name: round.name, description: round.description, questionCount: round.questions.length })),
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
        questions: round.questions.map((question) => ({
            _id: question._id,
            text: question.text,
            answer: question.answer,
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
                    deliveryMode: "online-assessment", count: count - manualTexts.length, excludeTexts: [...excludeTexts, ...manualTexts],
                });
            } catch { /* use deterministic fallback below */ }
            const texts = [...manualTexts, ...(Array.isArray(generated) ? generated : []).map((item) => typeof item === "string" ? item : item?.text).map((item) => (item || "").toString().trim()).filter(Boolean)].slice(0, count);
            while (texts.length < count) texts.push(`Describe how you would approach ${input.name} challenge ${texts.length + 1} for a ${jobRole}.`);
            excludeTexts.push(...texts);
            generatedRounds.push({ name: input.name, description: input.description || "", questions: texts.map((text) => ({ text })) });
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
        const rounds = assessment.rounds.map((round) => ({ name: round.name, description: round.description, questions: round.questions.map((question) => ({ text: question.text })) }));
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
        const { roundIndex, questionIndex, answer, followUpAnswer } = req.body;
        const item = attempt.rounds?.[roundIndex]?.questions?.[questionIndex];
        if (!item) { observeCandidateAction("answer", "invalid_question", assessment); return res.status(400).json({ message: "Invalid question" }); }
        if (answer !== undefined) item.answer = answer.toString().trim().slice(0, 5000);
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
        const attempt = await findAttempt(assessment._id, req.params.attemptId, req.get("x-attempt-token"));
        if (!attempt || attempt.status !== "started") { observeCandidateAction("submit", "unauthorized", assessment); return res.status(401).json({ message: "Attempt unavailable" }); }
        const unanswered = attempt.rounds.flatMap((round) => round.questions).some((item) => !item.answer || (item.followUpQuestion && !item.followUpAnswer));
        if (unanswered) { observeCandidateAction("submit", "incomplete", assessment); return res.status(400).json({ message: "Answer every question and follow-up before submitting" }); }
        const allScores = [];
        for (const round of attempt.rounds) {
            const roundScores = [];
            for (const item of round.questions) {
                const combined = `${item.answer}${item.followUpQuestion ? `\n\nFollow-up question: ${item.followUpQuestion}\nFollow-up answer: ${item.followUpAnswer}` : ""}`;
                const feedback = await generateFeedbackForAnswer({ questionText: item.text, userAnswer: combined });
                item.feedbackComment = feedback.comment; item.suggestions = feedback.suggestions; item.score = feedback.score;
                roundScores.push(feedback.score); allScores.push(feedback.score);
            }
            round.score = roundScores.length ? Math.round((roundScores.reduce((a, b) => a + b, 0) / roundScores.length) * 10) / 10 : 0;
        }
        attempt.overallScore = allScores.length ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10 : 0;
        attempt.status = "submitted"; attempt.submittedAt = new Date(); await attempt.save();
        observeCandidateAction("submit", "success", assessment);
        try { metrics.candidateAssessmentCompletionDurationSeconds.observe(Math.max((attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000, 0)); } catch {}
        return res.json({ submitted: true, message: "Your assessment has been submitted to the interviewer." });
    } catch (error) { observeCandidateAction("submit", "failure", null); return next(error); }
};
