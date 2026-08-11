import { generateQuestionsForRound } from "./generateQuestions/generate.js";
import { generateJSON } from "./generateQuestions/aiClient.js";
import { sanitizeText } from "./generateQuestions/textUtils.js";

export { generateQuestionsForRound };

export const improveAssessmentQuestion = async ({ question, instruction = "", jobRole = "", jobDescription = "", roundName = "" }) => {
    const original = sanitizeText(question, 1000);
    if (process.env.TEST_FORCE_GENERATOR_EMPTY === "true") return original;
    const prompt = `Rewrite one interview assessment question so it is clear, specific, unbiased, and capable of eliciting evidence from the candidate.
Preserve the original intent and difficulty. Do not answer the question or add commentary.
Role: ${sanitizeText(jobRole, 120)}
Round: ${sanitizeText(roundName, 80)}
Job context: ${sanitizeText(jobDescription, 1200)}
Optional interviewer instruction: ${sanitizeText(instruction, 500)}
Original question: ${original}
Return JSON exactly as {"text":"improved question"}.`;
    const raw = await generateJSON(prompt);
    try {
        const text = sanitizeText(JSON.parse(raw)?.text, 1000);
        return text || original;
    } catch { return original; }
};
