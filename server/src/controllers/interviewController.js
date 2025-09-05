import Interview from "../models/Interview.js";
import Round from "../models/Round.js";
import mongoose from "mongoose";

export const createInterview = async (req, res) => {
    const { resumeId, company, jobRole, jobDescription, rounds } = req.body;

    if (!resumeId || !company || !jobRole || !jobDescription || !Array.isArray(rounds) || rounds.length === 0) {
        return res.status(400).json({ message: "All fields and at least one round are required" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    const ops = [];
    try {
        // Create rounds first
        const roundDocs = await Round.insertMany(
            rounds.map((r) => ({
                name: r.roundName,
                description: r.description,
                deliveryMode: r.deliveryMode === "online-assessment" ? "online-assessment" : "conversational",
                questionLimit: Math.min(Math.max(Number(r.questionLimit) || 8, 1), 20),
                questions: [],
            })),
            { session }
        );

        if (roundDocs.length > 1) {

            for (let i = 0; i < roundDocs.length - 1; i++) {
                ops.push({
                    updateOne: {
                        filter: { _id: roundDocs[i]._id },
                        update: { $set: { nextRound: roundDocs[i + 1]._id } },
                    },
                });
            }
        }

        if (ops.length > 0) {
            await Round.bulkWrite(ops, { session });
        }

        const interview = await Interview.create(
            [
                {
                    user: req.user._id,
                    resume: resumeId,
                    company,
                    jobRole,
                    jobDescription,
                    rounds: roundDocs.map((r) => ({ round: r._id })),
                },
            ],
            { session }
        );

        await session.commitTransaction();
        session.endSession();
        return res.status(201).json(interview[0]);
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error creating interview with rounds:", error);
        return res.status(500).json({ message: error.message });
    }
};

export const getInterviews = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);

        // Total count for current user
        const filter = { user: req.user._id };
        const total = await Interview.countDocuments(filter);

        // If no pagination requested explicitly and small result set, maintain backward-compatible array response
        const paginationRequested = typeof req.query.page !== "undefined" || typeof req.query.limit !== "undefined";

        // Fetch paginated items sorted by newest first
        const itemsRaw = await Interview.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate({ path: "rounds.round", select: "status" })
            .lean();

        const items = (itemsRaw || []).map((it) => {
            try {
                const rounds = Array.isArray(it?.rounds) ? it.rounds : [];
                const total = rounds.length;
                const completed = rounds.reduce((acc, r) => acc + (r?.round?.status === "completed" ? 1 : 0), 0);
                const isCompleted = total > 0 && completed === total;
                return { ...it, roundsCompleted: completed, roundsTotal: total, isCompleted };
            } catch {
                return { ...it, roundsCompleted: 0, roundsTotal: 0, isCompleted: false };
            }
        });

        if (!paginationRequested && total <= limit) {
            return res.status(200).json(items);
        }

        const totalPages = Math.max(Math.ceil(total / limit), 1);
        return res.status(200).json({ items, total, page, limit, totalPages });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getInterview = async (req, res) => {
    try {
        const interview = await Interview.findById(req.params.id)
            .populate({
                path: "rounds.round",
                model: "Round",
                populate: [
                    { path: "questions.question", model: "Question" },
                    { path: "questions.feedback", model: "Feedback" },
                ],
            })
            .populate("resume"); // optional if you want resume info
        if (!interview) return res.status(404).json({ message: "Interview not found" });

        // Compute overallScore: average of round averages (per-question feedback scores)
        try {
            const rounds = Array.isArray(interview?.rounds) ? interview.rounds : [];
            const roundAverages = [];
            for (const r of rounds) {
                const qItems = Array.isArray(r?.round?.questions) ? r.round.questions : [];
                const scores = qItems
                    .map((it) => Number(it?.feedback?.score))
                    .filter((n) => Number.isFinite(n));
                if (scores.length > 0) {
                    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                    roundAverages.push(avg);
                }
            }
            const overall = roundAverages.length
                ? Math.round((roundAverages.reduce((a, b) => a + b, 0) / roundAverages.length) * 10) / 10
                : 0;
            // Attach to response without persisting
            const obj = interview.toObject();
            obj.overallScore = overall;
            return res.json(obj);
        } catch (_e) {
            return res.json(interview);
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};
