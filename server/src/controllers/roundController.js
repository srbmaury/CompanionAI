import { suggestRounds } from "../utils/interviewRounds.js";
import Round from "../models/Round.js";

export const getSuggestedRounds = async (req, res) => {
    const { company, jobRole, jobDescription } = req.body;

    if (!company || !jobRole || !jobDescription) {
        return res
            .status(400)
            .json({ message: "Company, Job Role, and JD are required" });
    }

    try {
        const rounds = await suggestRounds(company, jobRole, jobDescription);
        res.status(200).json(rounds);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const createRound = async (req, res) => {
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
        res.status(500).json({ message: error.message });
    }
};
