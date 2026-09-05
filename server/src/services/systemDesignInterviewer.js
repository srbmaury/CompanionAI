import { generateJSON } from "../utils/generateQuestions/aiClient.js";
import { sanitizeText } from "../utils/generateQuestions/textUtils.js";

const ALLOWED_KINDS = new Set(["clarify", "challenge", "constraint", "scale", "failure", "tradeoff", "security", "observability"]);

export const normalizeSystemDesignInterjection = (raw) => {
    if (!raw || typeof raw !== "object" || raw.shouldInterrupt !== true) {
        return { shouldInterrupt: false, interjection: null, kind: null, reason: sanitizeText(raw?.reason || "continue_listening", 180) };
    }
    const interjection = sanitizeText(raw.interjection || "", 600);
    if (!interjection) return { shouldInterrupt: false, interjection: null, kind: null, reason: "empty_interjection" };
    const kind = ALLOWED_KINDS.has(raw.kind) ? raw.kind : "challenge";
    return {
        shouldInterrupt: true,
        interjection,
        kind,
        reason: sanitizeText(raw.reason || "useful_interviewer_probe", 180),
    };
};

export const generateSystemDesignInterjection = async ({
    problem,
    transcript,
    diagramSummary = "",
    jobRole = "",
    roundName = "System Design",
    previousInterjections = [],
}) => {
    const recentTranscript = sanitizeText(transcript || "", 5000);
    if (recentTranscript.length < 120) return normalizeSystemDesignInterjection({ shouldInterrupt: false, reason: "not_enough_context" });

    const prior = (previousInterjections || [])
        .map((item) => sanitizeText(item, 500))
        .filter(Boolean)
        .slice(-8)
        .map((item, index) => `${index + 1}. ${item}`)
        .join("\n");

    const prompt = `You are a senior software engineer conducting a live system-design interview for a ${sanitizeText(jobRole || "software engineering", 120)} role.

Design problem:
${sanitizeText(problem || "Design the requested system.", 1000)}

Candidate's live discussion transcript so far:
${recentTranscript}

Current whiteboard summary:
${sanitizeText(diagramSummary || "No meaningful diagram elements are visible yet.", 2200)}

${prior ? `Questions/challenges you already interjected with:\n${prior}\n` : ""}
Decide whether a strong human interviewer would interrupt RIGHT NOW. Return ONLY valid JSON:
{"shouldInterrupt":boolean,"interjection":string|null,"kind":"clarify|challenge|constraint|scale|failure|tradeoff|security|observability|null","reason":string}

Interview behavior:
- The candidate owns the design. Do not coach, suggest components, reveal an ideal architecture, or praise/judge the answer.
- Most checkpoints should return shouldInterrupt=false. Interrupt only when there is a high-value reason.
- Good reasons: an important requirement is ambiguous; the candidate makes a consequential assumption without validating it; a key design choice needs justification; scale changes the architecture; a failure mode is being skipped; a trade-off was asserted without support; or the candidate has reached a natural point where a thoughtful interviewer would introduce a new constraint.
- Do NOT interrupt merely because another topic exists. Let the candidate finish coherent thoughts and tolerate thinking pauses.
- If interrupting, ask exactly ONE concise, natural question or introduce ONE realistic requirement change. Usually one sentence, never more than two short sentences.
- Make the interruption directly grounded in something the candidate has actually said or drawn.
- Avoid repeating prior interjections.
- Use realistic interviewer language such as “Let me pause you there—…”, “Suppose traffic grows 10x—…”, or “Before we go further, how are you thinking about…?” only when natural.
- Prefer discussion across requirements, capacity/scale, APIs/data model, component boundaries, data flow, bottlenecks, consistency, caching, partitioning, failure handling, security, observability, and explicit trade-offs as relevant to this particular design.
- Never turn the interview into a checklist.`;

    try {
        const text = await generateJSON(prompt);
        return normalizeSystemDesignInterjection(JSON.parse(text || "{}"));
    } catch {
        return normalizeSystemDesignInterjection({ shouldInterrupt: false, reason: "interviewer_provider_unavailable" });
    }
};

export default generateSystemDesignInterjection;
