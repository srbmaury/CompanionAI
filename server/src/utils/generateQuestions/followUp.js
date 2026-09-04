import { generateJSON } from "./aiClient.js";
import { sanitizeText } from "./textUtils.js";

export const MAX_FOLLOW_UPS = 3;

export const normalizeFollowUpDecision = (raw, remaining = MAX_FOLLOW_UPS) => {
    if (remaining <= 0 || !raw || typeof raw !== "object") {
        return { shouldAsk: false, followUp: null, reason: "probe_budget_exhausted", focus: null };
    }
    const followUp = typeof raw.followUp === "string" ? raw.followUp.trim().slice(0, 1000) : "";
    const shouldAsk = raw.shouldAsk === true && Boolean(followUp);
    return {
        shouldAsk,
        followUp: shouldAsk ? followUp : null,
        reason: sanitizeText(raw.reason || (shouldAsk ? "useful_probe" : "answer_sufficient"), 240),
        focus: shouldAsk ? sanitizeText(raw.focus || "technical_depth", 120) : null,
    };
};

const formatHistory = (followUps = []) => followUps
    .filter((item) => item?.question && item?.answer && !item?.skipped)
    .slice(0, MAX_FOLLOW_UPS)
    .map((item, index) => `Follow-up ${index + 1}: ${sanitizeText(item.question, 500)}\nCandidate: ${sanitizeText(item.answer, 1000)}`)
    .join("\n\n");

export const generateFollowUp = async ({
    questionText,
    userAnswer,
    followUps = [],
    jobRole,
    roundName,
    systemDesign = false,
}) => {
    const q = sanitizeText(questionText, 500);
    const a = sanitizeText(userAnswer, 1600);
    const role = sanitizeText(jobRole, 120);
    const rnd = sanitizeText(roundName, 80);
    const answeredFollowUps = (followUps || []).filter((item) => item?.answer && !item?.skipped).slice(0, MAX_FOLLOW_UPS);
    const remaining = Math.max(0, MAX_FOLLOW_UPS - (followUps || []).length);
    if (remaining <= 0) return normalizeFollowUpDecision(null, 0);

    const history = formatHistory(answeredFollowUps);
    const prompt = `You are conducting a realistic ${rnd || "technical"} interview for a ${role || "software engineering"} role.

Original question: "${q}"
Candidate's original answer: "${a}"
${history ? `\nConversation so far:\n${history}\n` : ""}
You may ask at most ${MAX_FOLLOW_UPS} follow-up questions for the original question. ${remaining} follow-up slot(s) remain.

Decide whether ONE MORE follow-up is genuinely useful now. Return ONLY valid JSON:
{"shouldAsk": boolean, "followUp": string | null, "reason": string, "focus": string | null}

Decision rules:
- Do NOT ask a follow-up just because budget remains. A strong, complete answer should move on immediately.
- Ask when one focused probe would materially improve signal: clarify ambiguity, validate a claim, test a trade-off, explore an important edge/failure case, or go one level deeper on something the candidate introduced.
- Base the next probe on the full conversation. Never repeat a point already answered clearly.
- Prefer depth over trivia. Ask one thing at a time, in natural interviewer language, usually one sentence.
- If the original answer is blank or extremely thin, the first probe may ask for a concrete explanation/example. Do not endlessly re-ask if the candidate remains vague.
- After two follow-ups, use the third only for a decision-relevant gap; otherwise stop.
- Never coach, reveal an ideal answer, praise, score, or hint at what the candidate should say.
${systemDesign ? `- For system design, probe an actual design choice: requirements, scale, API/data model, component boundaries, bottlenecks, consistency, failure handling, security, observability, or trade-offs. Do not invent components the candidate did not mention.` : ""}
- If no additional probe is warranted, return shouldAsk=false and followUp=null.`;

    const text = (await generateJSON(prompt)) || "{}";
    try {
        return normalizeFollowUpDecision(JSON.parse(text), remaining);
    } catch {
        return normalizeFollowUpDecision(null, remaining);
    }
};

export default generateFollowUp;
