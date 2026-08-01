import { suggestRounds } from "../utils/interviewRounds.js";
import Round from "../models/Round.js";

export const getSuggestedRounds = async (req, res, next) => {
    const { company, jobRole, jobDescription } = req.body;

    if (!company || !jobRole || !jobDescription) {
        return res
            .status(400)
            .json({ message: "Company, Job Role, and JD are required" });
    }

    try {
        const result = await suggestRounds(company, jobRole, jobDescription);
        res.status(200).json(result);
    } catch (error) {
        return next(error instanceof Error ? error : new Error(String(error)));
    }
};

export const createRound = async (req, res, next) => {
    const { roundName, description, deliveryMode } = req.body;

    if (!roundName || !description) {
        return res
            .status(400)
            .json({ message: "Name and Description are required" });
    }

    try {
        const round = await Round.create({
            name: roundName,
            description,
            deliveryMode: deliveryMode === "online-assessment" ? "online-assessment" : "conversational",
            questions: [],
        });

        res.status(201).json(round);
    } catch (error) {
        console.error("Error creating round:", error);
        return next(error instanceof Error ? error : new Error(String(error)));
    }
};
