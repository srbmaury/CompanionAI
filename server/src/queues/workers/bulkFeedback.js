import Feedback from "../../models/Feedback.js";
import Round from "../../models/Round.js";
import Question from "../../models/Question.js";
import { generateFeedbackForAnswer } from "../../utils/generateFeedback.js";
import Interview from "../../models/Interview.js";

export default async function bulkFeedbackProcessor(job) {
    const { roundId, items = [], attach = true, userId } = job.data || {};
    if (!userId || !await Interview.exists({ user: userId, "rounds.round": roundId })) {
        throw new Error("Round not found");
    }
    const round = await Round.findById(roundId);
    if (!round) throw new Error("Round not found");
    const total = Array.isArray(items) ? items.length : 0;
    if (total === 0) return { count: 0, attached: 0 };

    // Prefetch questions
    const qIds = items.map((it) => it?.questionId).filter(Boolean);
    const allowedIds = new Set((round.questions || []).map((item) => String(item.question)));
    if (qIds.some((id) => !allowedIds.has(String(id)))) throw new Error("Question not part of round");
    const qDocs = await Question.find({ _id: { $in: qIds } });
    const byId = new Map(qDocs.map((q) => [String(q._id), q]));

    let createdCount = 0;
    let attachedCount = 0;
    for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const q = byId.get(String(it.questionId));
        if (!q) {
            job.updateProgress(Math.round(((i + 1) / total) * 100));
            continue;
        }
        const gen = await generateFeedbackForAnswer({ questionText: q.text, userAnswer: (it.answer || "").toString() });
        const safeComment = (gen?.comment || "").toString().trim() || "Feedback unavailable.";
        const rawScore = Number(gen?.score);
        const clampedScore = Number.isFinite(rawScore) ? Math.min(10, Math.max(0, rawScore)) : undefined;
        const safeSuggestions = Array.isArray(gen?.suggestions)
            ? gen.suggestions.map((s) => (s || "").toString()).filter(Boolean).slice(0, 10)
            : [];
        const fb = await Feedback.create({ user: userId, question: q._id, comment: safeComment, score: clampedScore, suggestions: safeSuggestions });
        createdCount++;
        if (attach && Number.isInteger(Number(it.index)) && it.index >= 0 && it.index < (round.questions?.length || 0)) {
            round.questions[it.index].feedback = fb._id;
            attachedCount++;
        }
        job.updateProgress(Math.round(((i + 1) / total) * 100));
    }
    if (attach && attachedCount > 0) {
        await round.save();
    }
    return { count: createdCount, attached: attachedCount };
}
