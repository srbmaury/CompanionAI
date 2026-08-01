import { generateJSON } from "./generateQuestions/aiClient.js";

export const generateFeedbackForAnswer = async ({ questionText, userAnswer }) => {
    const q = (questionText || "").toString().trim().slice(0, 800);
    const a = (userAnswer || "").toString().trim().slice(0, 5000);
    if (!q) return { comment: "No question provided to evaluate.", score: 0, suggestions: [] };
    try {
        const prompt = `You are a concise technical interviewer.
Return ONLY JSON: {"comment": string, "score": number (0-10), "suggestions": string[] (max 5)}.
Question: ${q}
Candidate Answer: ${a}
Evaluate correctness, clarity, and depth. Be constructive in suggestions.`;

        const text = (await generateJSON(prompt)) || "{}";
        let obj = {};
        try { obj = JSON.parse(text); } catch (parseErr) {
            console.error("[Feedback:JSONParse] invalid provider response", parseErr?.message);
        }
        let comment = (obj?.comment || "").toString().trim().slice(0, 2000);
        if (!comment) comment = "Feedback unavailable.";
        let score = Number(obj?.score);
        if (!Number.isFinite(score)) score = 0;
        score = Math.max(0, Math.min(10, Math.round(score)));
        const suggestions = Array.isArray(obj?.suggestions)
            ? obj.suggestions.map((s) => (s || "").toString().trim().slice(0, 200)).filter(Boolean).slice(0, 5)
            : [];
        return { comment, score, suggestions };
    } catch (_e) {
        return { comment: "Feedback unavailable.", score: 0, suggestions: [] };
    }
};

export default generateFeedbackForAnswer;
