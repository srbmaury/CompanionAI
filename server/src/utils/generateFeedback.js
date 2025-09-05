import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Create clients lazily to ensure env vars are available and avoid constructing with empty keys
const getOpenAIClient = () => {
    const apiKey = process.env.OPENAI_API_KEY || "";
    return new OpenAI({ apiKey });
};

const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY || "";
    return new GoogleGenerativeAI(apiKey);
};

export const generateFeedbackForAnswer = async ({ questionText, userAnswer }) => {
    // Avoid printing raw keys; only log presence for debugging
    if (!process.env.OPENAI_API_KEY) console.warn("[Feedback] OPENAI_API_KEY missing");
    if (!process.env.GEMINI_API_KEY) console.warn("[Feedback] GEMINI_API_KEY missing (Gemini fallback may fail)");
    
    const q = (questionText || "").toString().trim().slice(0, 800);
    const a = (userAnswer || "").toString().trim().slice(0, 5000);
    if (!q) return { comment: "No question provided to evaluate.", score: 0, suggestions: [] };
    try {
        const prompt = `You are a concise technical interviewer.
Return ONLY JSON: {"comment": string, "score": number (0-10), "suggestions": string[] (max 5)}.
Question: ${q}
Candidate Answer: ${a}
Evaluate correctness, clarity, and depth. Be constructive in suggestions.`;

        let text = "";
        try {
            const modelName = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
            const openai = getOpenAIClient();
            const completion = await openai.chat.completions.create({
                model: modelName,
                messages: [
                    { role: "system", content: "Return ONLY raw JSON. No code fences." },
                    { role: "user", content: prompt },
                ],
                temperature: 0.2,
            });
            text = completion?.choices?.[0]?.message?.content || "";
            
        } catch (_e) {
            console.error("[Feedback:OpenAI] error status=", _e?.status, "code=", _e?.code, "msg=", _e?.message);
            // Fallback to Gemini
            try {
                const gemini = getGeminiClient();
                const model = gemini.getGenerativeModel({
                    model: process.env.GEMINI_MODEL_NAME || process.env.MODEL_NAME || "gemini-1.5-flash",
                    generationConfig: { responseMimeType: "application/json" },
                });
                const res = await model.generateContent(prompt);
                text = res?.response?.text?.() || "";
            } catch (__e) {
                console.error("[Feedback:Gemini] error msg=", __e?.message || __e);
                text = "{}";
            }
        }

        let obj = {};
        try { obj = JSON.parse(text); } catch (parseErr) {
            console.error("[Feedback:JSONParse] error=", parseErr?.message || parseErr, " raw=", text);
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
