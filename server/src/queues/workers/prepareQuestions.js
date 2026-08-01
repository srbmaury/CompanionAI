import Interview from "../../models/Interview.js";
import Round from "../../models/Round.js";
import Question from "../../models/Question.js";
import { generateQuestionsForRound } from "../../utils/generateQuestions.js";

// Processor for BullMQ
export default async function prepareQuestionsProcessor(job) {
    const { interviewId, roundId, count, prefetch, userId } = job.data || {};
    if (!userId) throw new Error("Missing job owner");
    job.updateProgress(5);
    const interview = await Interview.findOne({ _id: interviewId, user: userId, "rounds.round": roundId }).populate("resume").lean();
    if (!interview) throw new Error("Interview not found");
    const round = await Round.findById(roundId);
    if (!round) throw new Error("Round not found");

    // In non-prefetch, enforce ordering by previous completion
    if (!prefetch) {
        const order = interview.rounds.map((r) => String(r.round));
        const idx = order.indexOf(String(round._id));
        if (idx === -1) throw new Error("Round not part of interview");
        const allRoundDocs = await Round.find({ _id: { $in: order } }).select("_id status");
        const statusById = new Map(allRoundDocs.map((r) => [String(r._id), r.status]));
        for (let i = 0; i < idx; i++) {
            if (statusById.get(order[i]) !== "completed") {
                throw new Error("Previous round not completed");
            }
        }
    }

    const limit = Math.min(Math.max(count || round.questionLimit || 8, 1), 20);
    if (!prefetch) {
        round.conversationalIndex = 0;
        round.status = "in_progress";
    }
    round.questionLimit = limit;
    await round.save();
    job.updateProgress(20);

    // Exclusions across interview
    const allRoundIds = interview.rounds.map((r) => r.round);
    const allRounds = await Round.find({ _id: { $in: allRoundIds } }).populate({ path: "questions.question", select: "text" });
    const exclusionTexts = [];
    for (const r of allRounds) {
        for (const q of (r?.questions || [])) {
            const t = q?.question?.text;
            if (t) exclusionTexts.push(t);
        }
    }
    job.updateProgress(30);

    // Try generate; retry handled by BullMQ
    const qTexts = await generateQuestionsForRound({
        company: interview.company,
        jobRole: interview.jobRole,
        jobDescription: interview.jobDescription,
        resumeText: interview?.resume?.extractedText,
        roundName: round.name,
        roundDescription: round.description,
        deliveryMode: round.deliveryMode,
        count: limit,
        excludeTexts: exclusionTexts,
        grounding: interview.grounding,
    });
    job.updateProgress(70);
    const normalized = (Array.isArray(qTexts) ? qTexts : []).map((q) => (typeof q === "string" ? { text: q, tags: [] } : { text: String(q?.text || "").slice(0, 200), tags: Array.isArray(q?.tags) ? q.tags.slice(0, 10) : [] }));
    if (normalized.length === 0) throw new Error("Empty question list from generator");

    const created = await Question.insertMany(normalized.map(({ text, tags }) => ({ text, tags })));
    const questionRefs = created.map((q) => ({ question: q._id }));
    const updateSet = { questionLimit: questionRefs.length, questions: questionRefs };
    if (!prefetch) {
        updateSet.status = "in_progress";
        updateSet.conversationalIndex = 0;
    }
    await Round.updateOne({ _id: roundId }, { $set: updateSet });
    job.updateProgress(100);
    return { prepared: questionRefs.length };
}
