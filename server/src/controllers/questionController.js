import Interview from "../models/Interview.js";
import Round from "../models/Round.js";
import Question from "../models/Question.js";
import Feedback from "../models/Feedback.js";
import { generateQuestionsForRound } from "../utils/generateQuestions.js";
import { generateClarification } from "../utils/generateQuestions/clarify.js";
import { generateFollowUp } from "../utils/generateQuestions/followUp.js";
import { getQueue } from "../queues/index.js";

const findOwnedInterviewForRound = (userId, roundId) =>
    Interview.findOne({ user: userId, "rounds.round": roundId });

export const prepareQuestionsForRound = async (req, res, next) => {
    try {
        const { interviewId, roundId } = req.params;
        const { count = 8, prefetch = false } = req.body || {};

        const interview = await Interview.findOne({ _id: interviewId, user: req.user._id }).populate("resume").lean();
        if (!interview) return res.status(404).json({ message: "Interview not found" });

        const round = await Round.findById(roundId);
        if (!round) return res.status(404).json({ message: "Round not found" });

        const order = interview.rounds.map((r) => String(r.round));
        const idx = order.indexOf(String(round._id));
        if (idx === -1) return res.status(400).json({ message: "Round not part of interview" });
        if (!prefetch) {
            const allRoundDocs = await Round.find({ _id: { $in: order } }).select("_id status");
            const statusById = new Map(allRoundDocs.map((r) => [String(r._id), r.status]));
            for (let i = 0; i < idx; i++) {
                if (statusById.get(order[i]) !== "completed") {
                    return res.status(400).json({ message: "Previous round not completed" });
                }
            }
        }

        if (prefetch && Array.isArray(round.questions) && round.questions.length > 0) {
            const populatedExisting = await Round.findById(roundId).populate("questions.question");
            return res.json(populatedExisting);
        }

        const limit = Math.min(Math.max(count, 1), 20);
        if (!prefetch) {
            round.conversationalIndex = 0;
            round.status = "in_progress";
        }
        round.questionLimit = limit;

        const allRoundIds = interview.rounds.map((r) => r.round);
        const allRounds = await Round.find({ _id: { $in: allRoundIds } }).populate({
            path: "questions.question",
            select: "text",
        });
        const exclusionTexts = [];
        for (const r of allRounds) {
            for (const q of (r?.questions || [])) {
                const t = q?.question?.text;
                if (t) exclusionTexts.push(t);
            }
        }
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        let qTexts = [];
        let lastErr;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const res = await generateQuestionsForRound({
                    company: interview.company,
                    jobRole: interview.jobRole,
                    jobDescription: interview.jobDescription,
                    resumeText: interview?.resume?.extractedText,
                    roundName: round.name,
                    roundDescription: round.description,
                    deliveryMode: round.deliveryMode,
                    count: limit,
                    excludeTexts: exclusionTexts,
                });
                if (Array.isArray(res) && res.length > 0) {
                    qTexts = res;
                    break;
                }
                lastErr = new Error("Empty question list from generator");
            } catch (e) {
                lastErr = e;
            }
            if (attempt < 2) await sleep(400 * (attempt + 1));
        }
        if (!Array.isArray(qTexts) || qTexts.length === 0) {
            const tags = new Set();
            const add = (s) => {
                if (!s) return;
                const t = s.toString().toLowerCase().trim();
                if (t.length >= 2) tags.add(t);
            };
            add(interview.company);
            add(interview.jobRole);
            add(round.name);
            add(round.description);
            const tagArr = Array.from(tags).slice(0, 10);
            let fallback = [];
            if (tagArr.length > 0) {
                try {
                    fallback = await Question.find({ tags: { $in: tagArr } }).sort({ createdAt: -1 }).limit(limit).lean();
                } catch {}
            }
            if (!fallback || fallback.length === 0) {
                try {
                    const recent = await Question.find({}).sort({ createdAt: -1 }).limit(limit * 3).lean();
                    const seen = new Set(exclusionTexts.map((t) => (t || "").toLowerCase().trim().slice(0, 200)));
                    const dedup = [];
                    for (const q of recent) {
                        const key = (q?.text || "").toLowerCase().trim().slice(0, 200);
                        if (!key || seen.has(key)) continue;
                        dedup.push(q);
                        if (dedup.length >= limit) break;
                    }
                    fallback = dedup;
                } catch {}
            }
            if (!fallback || fallback.length === 0) {
                throw lastErr || new Error("Failed to generate questions");
            }
            const questionRefsFromDb = fallback.map((q) => ({ question: q._id }));
            const updateSetFallback = {
                questionLimit: questionRefsFromDb.length,
                questions: questionRefsFromDb,
            };
            if (!prefetch) {
                updateSetFallback.status = "in_progress";
                updateSetFallback.conversationalIndex = 0;
            }
            await Round.updateOne(
                { _id: roundId },
                { $set: updateSetFallback }
            );
            const populated = await Round.findById(roundId).populate("questions.question");
            return res.json(populated);
        }
        const normalized = qTexts.map((q) => {
            if (typeof q === "string") return { text: q, tags: [] };
            return { text: String(q?.text || "").slice(0, 200), tags: Array.isArray(q?.tags) ? q.tags.slice(0, 10) : [] };
        });
        const created = await Question.insertMany(normalized.map(({ text, tags }) => ({ text, tags })));
        const questionRefs = created.map((q) => ({ question: q._id }));
        const updateSet = {
            questionLimit: questionRefs.length,
            questions: questionRefs,
        };
        if (!prefetch) {
            updateSet.status = "in_progress";
            updateSet.conversationalIndex = 0;
        }
        await Round.updateOne(
            { _id: roundId },
            { $set: updateSet }
        );
        const populated = await Round.findById(roundId).populate("questions.question");
        return res.json(populated);
    } catch (error) {
        console.error("prepareQuestionsForRound error:", error);
        return next(error instanceof Error ? error : new Error(String(error)));
    }
};

export const submitConversationalAnswer = async (req, res, next) => {
    try {
        const { roundId } = req.params;
        const { index, answer } = req.body || {};
        const ownedInterview = await findOwnedInterviewForRound(req.user._id, roundId).lean();
        if (!ownedInterview) return res.status(404).json({ message: "Round not found" });
        const round = await Round.findById(roundId).populate("questions.question");
        if (!round) return res.status(404).json({ message: "Round not found" });
        if (round.deliveryMode !== "conversational")
            return res.status(400).json({ message: "Round is not conversational" });

        const idx = Number(index);
        const limit = Math.min(round.questionLimit || 8, 20);
        if (!Number.isInteger(idx) || idx < 0 || idx >= Math.min(round.questions.length, limit))
            return res.status(400).json({ message: "Invalid index" });

        round.questions[idx].answerGiven = (answer || "").toString().slice(0, 5000);
        if ((round.conversationalIndex || 0) === idx) {
            round.conversationalIndex = idx + 1;
        }
        const done = (round.conversationalIndex >= Math.min(round.questions.length, limit));
        if (done) round.status = "completed";
        await round.save();

        // If this was the last answer and the round is now completed, enqueue bulk feedback job server-side
        let feedbackJobId = null;
        if (done) {
            try {
                const items = (round.questions || [])
                    .map((q, i) => ({
                        index: i,
                        questionId: q?.question?._id || q?.question,
                        answer: (q?.answerGiven || "").toString().trim(),
                        hasFeedback: Boolean(q?.feedback),
                    }))
                    .filter((it) => it.questionId && it.answer.length > 0 && !it.hasFeedback)
                    .map(({ index, questionId, answer }) => ({ index, questionId, answer }));
                if (items.length > 0) {
                    const q = await getQueue("bulk-feedback");
                    if (q) {
                        const job = await q.add("bulk-feedback", { roundId, items, attach: true }, { removeOnComplete: { age: 3600, count: 500 }, removeOnFail: { age: 86400, count: 500 } });
                        feedbackJobId = job?.id || null;
                    }
                }
            } catch (e) {
                // Log and continue without failing the answer submission
                console.warn("enqueue bulk-feedback after conversational completion failed", e?.message || e);
            }
        }

        return res.json({ success: true, done, nextIndex: Math.min(round.conversationalIndex, Math.min(round.questions.length, limit)), feedbackJobId });
    } catch (error) {
        console.error("submitConversationalAnswer error:", error);
        return next(error instanceof Error ? error : new Error(String(error)));
    }
};

export const submitOAAnswers = async (req, res, next) => {
    try {
        const { roundId } = req.params;
        const { answers } = req.body || {};
        const ownedInterview = await findOwnedInterviewForRound(req.user._id, roundId).lean();
        if (!ownedInterview) return res.status(404).json({ message: "Round not found" });
        const round = await Round.findById(roundId).populate("questions.question");
        if (!round) return res.status(404).json({ message: "Round not found" });
        if (round.deliveryMode !== "online-assessment")
            return res.status(400).json({ message: "Round is not OA" });
        if (!Array.isArray(answers)) return res.status(400).json({ message: "Invalid answers" });

        const limit = Math.min(round.questions.length, round.questionLimit);
        for (let i = 0; i < limit; i++) {
            const a = (answers[i] || "").toString().slice(0, 5000);
            if (!round.questions[i]) break;
            round.questions[i].answerGiven = a;
        }
        await round.save();
        return res.json({ success: true });
    } catch (error) {
        console.error("submitOAAnswers error:", error);
        return next(error instanceof Error ? error : new Error(String(error)));
    }
};

export const completeRound = async (req, res, next) => {
    try {
        const { roundId } = req.params;
        const ownedInterview = await findOwnedInterviewForRound(req.user._id, roundId).lean();
        if (!ownedInterview) return res.status(404).json({ message: "Round not found" });
        const round = await Round.findById(roundId);
        if (!round) return res.status(404).json({ message: "Round not found" });
        round.status = "completed";
        await round.save();
        return res.json({ success: true });
    } catch (error) {
        console.error("completeRound error:", error);
        return next(error instanceof Error ? error : new Error(String(error)));
    }
};

export const skipRound = async (req, res, next) => {
    try {
        const { interviewId, roundId } = req.params;
        const interview = await Interview.findOne({ _id: interviewId, user: req.user._id });
        if (!interview) return res.status(404).json({ message: "Interview not found" });

        const belongs = interview.rounds.some((r) => String(r.round) === String(roundId));
        if (!belongs) return res.status(400).json({ message: "Round not part of interview" });

        const round = await Round.findById(roundId);
        if (!round) return res.status(404).json({ message: "Round not found" });
        if (round.status === "completed") return res.status(400).json({ message: "Cannot skip a completed round" });

        const qIds = (round.questions || [])
            .map((q) => q?.question)
            .filter(Boolean);
        if (qIds.length > 0) {
            await Feedback.deleteMany({ question: { $in: qIds } });
            await Question.deleteMany({ _id: { $in: qIds } });
        }

        await Interview.updateOne(
            { _id: interviewId, user: req.user._id },
            { $pull: { rounds: { round: roundId } } }
        );
        await Round.deleteOne({ _id: roundId });

        return res.json({ success: true });
    } catch (error) {
        console.error("skipRound error:", error);
        return next(error instanceof Error ? error : new Error(String(error)));
    }
};

export const getFollowUp = async (req, res, next) => {
    try {
        const { roundId } = req.params;
        const { index, answer } = req.body || {};

        const interview = await findOwnedInterviewForRound(req.user._id, roundId).lean();
        if (!interview) return res.status(404).json({ message: "Round not found" });
        const round = await Round.findById(roundId).populate("questions.question");
        if (!round) return res.status(404).json({ message: "Round not found" });
        if (round.deliveryMode !== "conversational")
            return res.status(400).json({ message: "Round is not conversational" });

        const idx = Number(index) || 0;
        const questionText = round.questions?.[idx]?.question?.text || "";

        const followUp = await generateFollowUp({
            questionText,
            userAnswer: (answer || "").toString().trim(),
            jobRole: interview?.jobRole || "",
            roundName: round.name || "",
        });

        return res.json({ followUp });
    } catch (error) {
        console.error("getFollowUp error:", error);
        return next(error instanceof Error ? error : new Error(String(error)));
    }
};

export const clarifyCurrentQuestion = async (req, res, next) => {
    try {
        const { roundId } = req.params;
        const { message } = req.body || {};
        if (!message || !message.toString().trim()) return res.status(400).json({ message: "Message required" });
        const interview = await findOwnedInterviewForRound(req.user._id, roundId).lean();
        if (!interview) return res.status(404).json({ message: "Round not found" });
        const round = await Round.findById(roundId).populate("questions.question");
        if (!round) return res.status(404).json({ message: "Round not found" });
        if (round.deliveryMode !== "conversational")
            return res.status(400).json({ message: "Round is not conversational" });
        const idx = Number(round.conversationalIndex) || 0;
        const current = round.questions?.[idx] || round.questions?.[idx - 1] || round.questions?.[0];
        const qText = current?.question?.text || "";

        const role = interview?.jobRole || "";

        const answer = await generateClarification({
            questionText: qText,
            userMessage: message,
            jobRole: role,
            roundName: round.name,
        });
        return res.json({ answer });
    } catch (error) {
        console.error("clarifyCurrentQuestion error:", error);
        return next(error instanceof Error ? error : new Error(String(error)));
    }
};
