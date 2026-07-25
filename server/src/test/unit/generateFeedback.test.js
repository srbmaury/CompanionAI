import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the AI client so tests don't make real network calls
vi.mock("../../utils/generateQuestions/aiClient.js", () => ({
    generateJSON: vi.fn(),
}));

import { generateJSON } from "../../utils/generateQuestions/aiClient.js";
import { generateFeedbackForAnswer } from "../../utils/generateFeedback.js";

describe("generateFeedbackForAnswer", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns structured feedback on a valid AI response", async () => {
        generateJSON.mockResolvedValue(JSON.stringify({
            comment: "Good answer",
            score: 8,
            suggestions: ["Be more concise", "Add an example"],
        }));

        const result = await generateFeedbackForAnswer({
            questionText: "What is a closure?",
            userAnswer: "A closure is a function that captures its outer scope.",
        });

        expect(result.comment).toBe("Good answer");
        expect(result.score).toBe(8);
        expect(result.suggestions).toHaveLength(2);
    });

    it("clamps score to 0–10 range", async () => {
        generateJSON.mockResolvedValue(JSON.stringify({ comment: "ok", score: 99, suggestions: [] }));
        const result = await generateFeedbackForAnswer({ questionText: "Q", userAnswer: "A" });
        expect(result.score).toBe(10);
    });

    it("returns fallback when AI returns empty", async () => {
        generateJSON.mockResolvedValue("");
        const result = await generateFeedbackForAnswer({ questionText: "Q", userAnswer: "A" });
        expect(result.comment).toBe("Feedback unavailable.");
        expect(result.score).toBe(0);
    });

    it("returns fallback when AI throws", async () => {
        generateJSON.mockRejectedValue(new Error("timeout"));
        const result = await generateFeedbackForAnswer({ questionText: "Q", userAnswer: "A" });
        expect(result.comment).toBe("Feedback unavailable.");
    });

    it("returns early error when questionText is empty", async () => {
        const result = await generateFeedbackForAnswer({ questionText: "", userAnswer: "A" });
        expect(result.comment).toBe("No question provided to evaluate.");
        expect(generateJSON).not.toHaveBeenCalled();
    });

    it("filters empty suggestions", async () => {
        generateJSON.mockResolvedValue(JSON.stringify({
            comment: "ok",
            score: 5,
            suggestions: ["  ", "valid suggestion", ""],
        }));
        const result = await generateFeedbackForAnswer({ questionText: "Q", userAnswer: "A" });
        expect(result.suggestions).toEqual(["valid suggestion"]);
    });
});
