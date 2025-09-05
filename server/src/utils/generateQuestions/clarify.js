import { generateJSON } from "./aiClient.js";
import { sanitizeText } from "./textUtils.js";

export const generateClarification = async ({ questionText, userMessage, jobRole, roundName }) => {
    const q = sanitizeText(questionText, 400);
    const m = sanitizeText(userMessage, 600);
    const role = sanitizeText(jobRole, 120);
    const rnd = sanitizeText(roundName, 60);
    const prompt = `You are a helpful interviewer.
Return ONLY JSON: {"answer": string}.
Goal: briefly clarify the candidate's doubt about the current interview question without revealing the full solution. Keep it <= 5 sentences.
Context:
- Role: ${role}
- Round: ${rnd}
- Question: ${q}
- Candidate Doubt: ${m}`;

    const text = (await generateJSON(prompt)) || "{}";
    try {
        const obj = JSON.parse(text);
        const ans = sanitizeText(obj?.answer, 1200);
        return ans;
    } catch {
        return "";
    }
};

export default generateClarification;