import Feedback from "../models/Feedback.js";
import Round from "../models/Round.js";
import Question from "../models/Question.js";
import { generateFeedbackForAnswer } from "../utils/generateFeedback.js";

// Create feedback for a specific question (by questionId)
export const createFeedback = async (req, res) => {
    try {
        const { questionId } = req.params;
        const { answer } = req.body || {};
        const qDoc = await Question.findById(questionId);
        if (!qDoc) return res.status(404).json({ message: "Question not found" });
        const gen = await generateFeedbackForAnswer({ questionText: qDoc.text, userAnswer: answer });
        const safeComment = (gen?.comment || "").toString().trim() || "Feedback unavailable.";
        const rawScore = Number(gen?.score);
        const clampedScore = Number.isFinite(rawScore) ? Math.min(10, Math.max(0, rawScore)) : undefined;
        const safeSuggestions = Array.isArray(gen?.suggestions)
            ? gen.suggestions.map((s) => (s || "").toString()).filter(Boolean).slice(0, 10)
            : [];
        const fb = await Feedback.create({
            question: questionId,
            comment: safeComment,
            score: clampedScore,
            suggestions: safeSuggestions,
        });
        return res.status(201).json(fb);
    } catch (error) {
        console.error("createFeedback error:", error);
        return res.status(500).json({ message: error.message });
    }
};

// Attach feedback to a question inside a round (by roundId and index)
export const attachFeedbackToRoundQuestion = async (req, res) => {
    try {
        const { roundId } = req.params;
        const { index, feedbackId } = req.body || {};
        const round = await Round.findById(roundId);
        if (!round) return res.status(404).json({ message: "Round not found" });
        const idx = Number(index);
        if (!Number.isInteger(idx) || idx < 0 || idx >= (round.questions?.length || 0))
            return res.status(400).json({ message: "Invalid index" });
        round.questions[idx].feedback = feedbackId;
        await round.save();
        return res.json({ success: true });
    } catch (error) {
        console.error("attachFeedbackToRoundQuestion error:", error);
        return res.status(500).json({ message: error.message });
    }
};

// Get feedback list for a question
export const getFeedbackForQuestion = async (req, res) => {
    try {
        const { questionId } = req.params;
        const list = await Feedback.find({ question: questionId }).sort({ createdAt: -1 });
        return res.json(list);
    } catch (error) {
        console.error("getFeedbackForQuestion error:", error);
        return res.status(500).json({ message: error.message });
    }
};

// Bulk feedback for OA rounds: accepts array of { questionId, answer }
export const createBulkFeedback = async (req, res) => {
    try {
        const { items } = req.body || {};
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "No items provided" });
        }
        const qIds = items.map((it) => it?.questionId).filter(Boolean);
        const qDocs = await Question.find({ _id: { $in: qIds } });
        const byId = new Map(qDocs.map((q) => [String(q._id), q]));

        const results = [];
        for (const it of items) {
            const q = byId.get(String(it.questionId));
            if (!q) continue;
            const gen = await generateFeedbackForAnswer({ questionText: q.text, userAnswer: it.answer });
            const safeComment = (gen?.comment || "").toString().trim() || "Feedback unavailable.";
            const rawScore = Number(gen?.score);
            const clampedScore = Number.isFinite(rawScore) ? Math.min(10, Math.max(0, rawScore)) : undefined;
            const safeSuggestions = Array.isArray(gen?.suggestions)
                ? gen.suggestions.map((s) => (s || "").toString()).filter(Boolean).slice(0, 10)
                : [];
            const fb = await Feedback.create({
                question: q._id,
                comment: safeComment,
                score: clampedScore,
                suggestions: safeSuggestions,
            });
            results.push(fb);
        }
        return res.status(201).json({ count: results.length, feedback: results });
    } catch (error) {
        console.error("createBulkFeedback error:", error);
        return res.status(500).json({ message: error.message });
    }
};
