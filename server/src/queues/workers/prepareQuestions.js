import Interview from "../../models/Interview.js";
import Round from "../../models/Round.js";
import Question from "../../models/Question.js";
import { generateQuestionsForRound } from "../../utils/generateQuestions.js";
import {
    chooseNextCompetency,
    generateNextAdaptiveQuestion,
    initializeAdaptiveInterviewState,
    selectResumeClaimForTarget,
} from "../../services/adaptiveInterviewEngine.js";

export default async function prepareQuestionsProcessor(job) {
    const { interviewId, roundId, count, prefetch, userId } = job.data || {};
    if (!userId) throw new Error("Missing job owner");
    await job.updateProgress(5);
    const interview = await Interview.findOne({ _id: interviewId, user: userId, "rounds.round": roundId }).populate("resume").lean();
    if (!interview) throw new Error("Interview not found");
    const round = await Round.findById(roundId);
    if (!round) throw new Error("Round not found");

    if (!prefetch) {
        const order = interview.rounds.map((r) => String(r.round));
        const idx = order.indexOf(String(round._id));
        if (idx === -1) throw new Error("Round not part of interview");
        const allRoundDocs = await Round.find({ _id: { $in: order } }).select("_id status");
        const statusById = new Map(allRoundDocs.map((r) => [String(r._id), r.status]));
        for (let i = 0; i < idx; i++) {
            if (statusById.get(order[i]) !== "completed") throw new Error("Previous round not completed");
        }
    }

    if ((round.questions || []).length > 0) {
        if (!prefetch && round.status === "pending") {
            round.status = "in_progress";
            await round.save();
        }
        await job.updateProgress(100);
        return { prepared: round.questions.length, adaptive: Boolean(round.adaptiveState?.enabled) };
    }

    const limit = Math.min(Math.max(Number(count) || Number(round.questionLimit) || 5, 1), 20);
    round.questionLimit = limit;
    await job.updateProgress(15);

    const allRoundIds = interview.rounds.map((r) => r.round);
    const allRounds = await Round.find({ _id: { $in: allRoundIds } }).populate({ path: "questions.question", select: "text" });
    const exclusionTexts = allRounds.flatMap((r) => (r?.questions || []).map((q) => q?.question?.text).filter(Boolean));
    await job.updateProgress(25);

    if (round.deliveryMode === "conversational") {
        const state = await initializeAdaptiveInterviewState({
            jobRole: interview.jobRole,
            jobDescription: interview.jobDescription,
            roundName: round.name,
            roundDescription: round.description,
            skills: round.skills || [],
            resumeText: interview?.resume?.extractedText || "",
            maxQuestions: limit,
        });
        await job.updateProgress(55);
        const target = chooseNextCompetency(state);
        const claim = selectResumeClaimForTarget(state, target);
        const spec = await generateNextAdaptiveQuestion({
            interview,
            round,
            state,
            targetCompetency: target,
            difficulty: state.currentDifficulty,
            sourceClaim: claim?.claim || "",
            excludeTexts: exclusionTexts,
        });
        if (!spec?.text) throw new Error("Empty adaptive question from generator");
        const question = await Question.create({ text: spec.text, tags: spec.tags || [] });
        round.adaptiveState = state;
        round.adaptiveState.lastDecision = {
            action: "next-question",
            targetCompetency: target,
            sourceClaim: claim?.claim || "",
            reason: "Initial question selected from the round evidence plan.",
            confidence: 1,
            difficulty: spec.difficulty,
            decidedAt: new Date(),
        };
        round.questions = [{
            question: question._id,
            difficulty: spec.difficulty,
            competencies: spec.competencies || [target],
            sourceType: spec.sourceType || "adaptive",
            sourceClaim: spec.sourceClaim || "",
            followUps: [],
        }];
        round.conversationalIndex = 0;
        if (!prefetch) round.status = "in_progress";
        await round.save();
        await job.updateProgress(100);
        return { prepared: 1, adaptive: true, maxQuestions: state.maxQuestions };
    }

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
    await job.updateProgress(70);
    const normalized = (Array.isArray(qTexts) ? qTexts : []).map((q) => (typeof q === "string"
        ? { text: q, tags: [] }
        : { text: String(q?.text || "").slice(0, 500), tags: Array.isArray(q?.tags) ? q.tags.slice(0, 10) : [] }));
    if (normalized.length === 0) throw new Error("Empty question list from generator");

    const created = await Question.insertMany(normalized.map(({ text, tags }) => ({ text, tags })));
    round.questions = created.map((q) => ({ question: q._id, sourceType: "planned" }));
    round.questionLimit = round.questions.length;
    if (!prefetch) {
        round.status = "in_progress";
        round.conversationalIndex = 0;
    }
    await round.save();
    await job.updateProgress(100);
    return { prepared: round.questions.length, adaptive: false };
}
