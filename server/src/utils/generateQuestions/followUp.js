import { generateJSON } from "./aiClient.js";
import { sanitizeText } from "./textUtils.js";

export const MAX_FOLLOW_UPS = 3;

export const normalizeFollowUpDecision = (raw, remaining = MAX_FOLLOW_UPS) => {
    if (remaining <= 0 || !raw || typeof raw !== "object") {
        return { shouldAsk: false, followUp: null, reason: "probe_budget_exhausted", focus: null, answerConfidence: 1, missingEvidence: [] };
    }
    const followUp = typeof raw.followUp === "string" ? raw.followUp.trim().slice(0, 1000) : "";
    const shouldAsk = raw.shouldAsk === true && Boolean(followUp);
    return {
        shouldAsk,
        followUp: shouldAsk ? followUp : null,
        reason: sanitizeText(raw.reason || (shouldAsk ? "useful_probe" : "answer_sufficient"), 240),
        focus: shouldAsk ? sanitizeText(raw.focus || "technical_depth", 120) : null,
        answerConfidence: Math.max(0, Math.min(1, Number(raw.answerConfidence) || 0)),
        missingEvidence: Array.isArray(raw.missingEvidence)
            ? raw.missingEvidence.map((item) => sanitizeText(item, 160)).filter(Boolean).slice(0, 4)
            : [],
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
    competencies = [],
    sourceClaim = "",
}) => {
    const q = sanitizeText(questionText, 500);
    const a = sanitizeText(userAnswer, 1800);
    const role = sanitizeText(jobRole, 120);
    const rnd = sanitizeText(roundName, 80);
    const answeredFollowUps = (followUps || []).filter((item) => item?.answer && !item?.skipped).slice(0, MAX_FOLLOW_UPS);
    const remaining = Math.max(0, MAX_FOLLOW_UPS - (followUps || []).length);
    if (remaining <= 0) return normalizeFollowUpDecision(null, 0);

    const history = formatHistory(answeredFollowUps);
    const competencyText = (Array.isArray(competencies) ? competencies : []).map((item) => sanitizeText(item, 80)).filter(Boolean).slice(0, 4).join(", ");
    const claim = sanitizeText(sourceClaim, 500);
    const prompt = `You are conducting a realistic, conversational ${rnd || "technical"} interview for a ${role || "software engineering"} role.

Original question: "${q}"
Candidate's original answer: "${a}"
Target competencies: ${competencyText || "infer from the question"}
${claim ? `Resume claim being validated: ${claim}` : ""}
${history ? `\nConversation so far:\n${history}\n` : ""}
You may ask at most ${MAX_FOLLOW_UPS} follow-up questions for the original question. ${remaining} follow-up slot(s) remain.

Return ONLY valid JSON:
{"shouldAsk":boolean,"followUp":string|null,"reason":string,"focus":string|null,"answerConfidence":0.0,"missingEvidence":["..."]}

Decision policy:
- First estimate answerConfidence: confidence that the conversation already gives enough evidence to judge the IMPORTANT target competency, not confidence that the candidate is correct.
- Identify only decision-relevant missingEvidence. Ignore trivia and nice-to-have details.
- Ask ONE more follow-up only when missing evidence materially affects the competency judgment and a focused probe can resolve it.
- High-confidence complete evidence => stop, even if follow-up budget remains.
- Low confidence caused by one important ambiguity/unsupported claim/trade-off/failure case => probe that exact gap.
- Low confidence caused by a very thin or irrelevant answer may justify one rescue probe, but do not repeatedly re-ask the same concept.
- Base the next probe on the full conversation. Never repeat something already answered clearly.
- Sound like a thoughtful human interviewer continuing the same conversation. Use concise transitions such as “Got it — …”, “Makes sense. How did you…”, or “Let’s go one level deeper…” only when they fit naturally; do not prepend filler mechanically.
- Keep the tone warm, neutral, and professional. Avoid robotic rubric language, interrogation-style wording, praise, judgment, or canned acknowledgements.
- Prefer depth over trivia. Ask one thing at a time, in natural interviewer language, usually one sentence.
- After two follow-ups, use the third only when uncertainty remains on a core hiring signal.
- Never coach, reveal an ideal answer, praise, score, or hint at what the candidate should say.
${claim ? "- For the resume claim, prioritize verification of actual ownership, measurement/evidence, technical decisions, constraints, trade-offs, or failure modes that remain unsupported." : ""}
${systemDesign ? "- For system design, probe an actual design choice: requirements, scale, API/data model, component boundaries, bottlenecks, consistency, failure handling, security, observability, or trade-offs. Do not invent components the candidate did not mention." : ""}
- If no additional probe is warranted, return shouldAsk=false and followUp=null.`;

    try {
        const text = (await generateJSON(prompt)) || "{}";
        return normalizeFollowUpDecision(JSON.parse(text), remaining);
    } catch {
        // A provider outage must not block the interview. Moving on is safer than
        // inventing an ungrounded follow-up locally.
        return normalizeFollowUpDecision({
            shouldAsk: false,
            followUp: null,
            reason: "followup_provider_unavailable",
            answerConfidence: 0,
            missingEvidence: [],
        }, remaining);
    }
};

export default generateFollowUp;
