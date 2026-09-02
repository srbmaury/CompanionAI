import { generateJSON } from "./generateQuestions/aiClient.js";

export const generateFeedbackForAnswer = async ({ questionText, userAnswer, evaluationContext }) => {
    const q = (questionText || "").toString().trim().slice(0, 800);
    const a = (userAnswer || "").toString().trim().slice(0, 5000);
    if (!q) return { comment: "No question provided to evaluate.", score: 0, suggestions: [] };
    try {
        const systemDesign = evaluationContext?.mode === "system-design";
        const context = systemDesign ? `
This is a system-design response for ${String(evaluationContext.jobRole || "a technical role").slice(0, 120)}.
Role context: ${String(evaluationContext.jobDescription || "").slice(0, 1600)}
Round focus: ${String(evaluationContext.roundDescription || "").slice(0, 300)}
Scorecard: ${(evaluationContext.rubric || []).map((item) => `${item.name}: ${item.description || ""}`).join("; ").slice(0, 1200)}
Evaluate requirements clarification, architecture coherence, data flow, scale/capacity reasoning, reliability, consistency, security, observability, and trade-offs. Treat diagram extraction as evidence, not ground truth. Do not reward visual polish or penalize drawing quality. Explicitly mention uncertainty when a claimed diagram relationship is unclear.` : "";
        const prompt = `You are a concise technical interviewer.${context}
Return ONLY JSON: {"comment": string, "score": number (0-10), "suggestions": string[] (max 5)}.
Question: ${q}
Candidate Answer: ${a}
Evaluate correctness, clarity, and depth. Be constructive in suggestions.`;

        const text = await generateJSON(prompt);
        if (!text) throw new Error("AI providers returned no evaluation");
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
    } catch (_e) { throw _e; }
};

export default generateFeedbackForAnswer;
