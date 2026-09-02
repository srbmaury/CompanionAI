import { generateJSON } from "./aiClient.js";
import { sanitizeText } from "./textUtils.js";

export const generateFollowUp = async ({ questionText, userAnswer, jobRole, roundName, systemDesign = false }) => {
    const q = sanitizeText(questionText, 400);
    const a = sanitizeText(userAnswer, 1000);
    const role = sanitizeText(jobRole, 120);
    const rnd = sanitizeText(roundName, 60);

    const prompt = `You are a technical interviewer for a ${rnd || "technical"} round at a ${role || "software engineering"} company.

Question asked: "${q}"
Candidate answered: "${a}"

Should you ask a follow-up question? Return ONLY valid JSON: {"followUp": string | null}
Rules:
- If the answer is thorough and complete, return {"followUp": null}.
- If a follow-up is warranted (probe deeper, clarify a vague point, test an edge case not covered), write one concise follow-up question (1-2 sentences max).
- If the answer is blank or very short (fewer than 15 words), ask the candidate to elaborate.
- Do not repeat or paraphrase what the candidate already clearly stated.
${systemDesign ? `- Act as a system-design interviewer, not a coach: never provide the solution or praise/score the design.
- Base the probe on a concrete component, connection, missing requirement, failure mode, capacity assumption, data-consistency choice, security boundary, or observability gap visible in the supplied evidence.
- Ask only one neutral question. If diagram extraction is uncertain, ask the candidate to clarify rather than assuming a connection exists.` : ""}`;

    const text = (await generateJSON(prompt)) || "{}";
    try {
        const obj = JSON.parse(text);
        const fu = obj?.followUp;
        if (typeof fu === "string" && fu.trim()) return fu.trim();
        return null;
    } catch {
        return null;
    }
};

export default generateFollowUp;
