import { suggestRounds } from "../utils/interviewRounds.js";
import Round from "../models/Round.js";
import Resume from "../models/Resume.js";

const roundText = (round = {}) => `${round.roundName || ""} ${round.description || ""} ${(round.skills || []).join(" ")}`.toLowerCase();
const suggestedQuestionLimit = (round = {}) => {
    const text = roundText(round);
    if (/system\s*design|architecture/.test(text)) return 1;
    if (round.deliveryMode === "online-assessment") return 2;
    if (/recruiter|screen|behavior|culture|hiring manager|leadership|ownership|collaboration/.test(text)) return 3;
    return 4;
};
const withRealisticRoundSizes = (result) => {
    const normalize = (round) => ({ ...round, questionLimit: suggestedQuestionLimit(round) });
    if (Array.isArray(result)) return result.map(normalize);
    if (Array.isArray(result?.rounds)) return { ...result, rounds: result.rounds.map(normalize) };
    return result;
};

export const getSuggestedRounds = async (req, res, next) => {
    const { company, jobRole, jobDescription, resumeId } = req.body;
    if (!jobRole || !jobDescription) return res.status(400).json({ message: "Job Role and JD are required" });

    try {
        let resumeText = "";
        if (resumeId) {
            const resume = await Resume.findOne({ _id: resumeId, user: req.user._id }).select("extractedText").lean();
            if (!resume) return res.status(404).json({ message: "Resume not found" });
            resumeText = resume.extractedText || "";
        }
        const result = await suggestRounds(company || "", jobRole, jobDescription, { resumeText });
        return res.status(200).json(withRealisticRoundSizes(result));
    } catch (error) {
        return next(error instanceof Error ? error : new Error(String(error)));
    }
};

export const createRound = async (req, res, next) => {
    const { roundName, description, deliveryMode } = req.body;
    if (!roundName || !description) return res.status(400).json({ message: "Name and Description are required" });
    try {
        const round = await Round.create({
            name: roundName,
            description,
            deliveryMode: deliveryMode === "online-assessment" ? "online-assessment" : "conversational",
            questions: [],
        });
        return res.status(201).json(round);
    } catch (error) {
        console.error("Error creating round:", error);
        return next(error instanceof Error ? error : new Error(String(error)));
    }
};
