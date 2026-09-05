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

const fallbackForcedInterjection = ({ previousInterjections = [] }) => {
    const probes = [
        { kind: "clarify", text: "Before we go further, what scale and traffic assumptions are you designing for?" },
        { kind: "challenge", text: "Walk me through the main request and data flow end to end—where do you expect the first bottleneck?" },
        { kind: "failure", text: "Suppose one of your critical data stores becomes unavailable—how does the system behave?" },
        { kind: "tradeoff", text: "Which consistency guarantees actually matter here, and what are you willing to trade for availability or latency?" },
        { kind: "scale", text: "Suppose traffic grows 10× from your current assumption—what part of this design changes first?" },
        { kind: "observability", text: "How would you know in production that this design is degrading before users start reporting it?" },
    ];
    const index = Math.min(previousInterjections.length, probes.length - 1);
    const probe = probes[index];
    return normalizeSystemDesignInterjection({
        shouldInterrupt: true,
        interjection: probe.text,
        kind: probe.kind,
        reason: "forced_live_interviewer_probe",
    });
};

export const generateSystemDesignInterjection = async ({
    problem,
    transcript,
    diagramSummary = "",
    jobRole = "",
    roundName = "System Design",
    previousInterjections = [],
    forceInteraction = false,
}) => {
    const recentTranscript = sanitizeText(transcript || "", 5000);
    if (recentTranscript.length < 80) return normalizeSystemDesignInterjection({ shouldInterrupt: false, reason: "not_enough_context" });

    const prior = (previousInterjections || [])
        .map((item) => sanitizeText(item, 500))
        .filter(Boolean)
        .slice(-8)
        .map((item, index) => `${index + 1}. ${item}`)
        .join("\n");

    const prompt = `You are a senior software engineer conducting a live, interactive system-design interview for a ${sanitizeText(jobRole || "software engineering", 120)} role.

Design problem:
${sanitizeText(problem || "Design the requested system.", 1000)}

Candidate's live discussion transcript so far:
${recentTranscript}

Current whiteboard summary:
${sanitizeText(diagramSummary || "No meaningful diagram elements are visible yet.", 2200)}

${prior ? `Questions/challenges you already interjected with:\n${prior}\n` : ""}
This checkpoint ${forceInteraction ? "REQUIRES an interviewer turn now because the discussion has gone too long without interaction" : "lets you decide whether to interject now"}.

Return ONLY valid JSON:
{"shouldInterrupt":boolean,"interjection":string|null,"kind":"clarify|challenge|constraint|scale|failure|tradeoff|security|observability|null","reason":string}

Interview behavior:
- The candidate owns the design. Do not coach, suggest components, reveal an ideal architecture, or praise/judge the answer.
- This must feel like a real two-way interview, not a monologue. Ask clarifying questions, challenge assumptions, and introduce realistic requirement changes at useful moments.
- When this checkpoint REQUIRES an interviewer turn, return shouldInterrupt=true and ask exactly one high-value question grounded in the discussion so far.
- Otherwise, remain silent when the candidate is in the middle of a coherent thought or there is no useful reason to interrupt.
- Good reasons: an important requirement is ambiguous; the candidate makes a consequential assumption without validating it; a key design choice needs justification; scale changes the architecture; a failure mode is being skipped; a trade-off was asserted without support; or the candidate has reached a natural point where a thoughtful interviewer would introduce a new constraint.
- If interrupting, ask exactly ONE concise, natural question or introduce ONE realistic requirement change. Usually one sentence, never more than two short sentences.
- Make the interruption directly grounded in something the candidate has actually said or drawn whenever possible.
- Avoid repeating prior interjections.
- Use realistic interviewer language such as “Let me pause you there—…”, “Suppose traffic grows 10x—…”, or “Before we go further, how are you thinking about…?” when natural.
- Prefer discussion across requirements, capacity/scale, APIs/data model, component boundaries, data flow, bottlenecks, consistency, caching, partitioning, failure handling, security, observability, and explicit trade-offs as relevant to this particular design.
- Never turn the interview into a checklist.`;

    try {
        const text = await generateJSON(prompt);
        const decision = normalizeSystemDesignInterjection(JSON.parse(text || "{}"));
        if (forceInteraction && !decision.shouldInterrupt) {
            return fallbackForcedInterjection({ previousInterjections });
        }
        return decision;
    } catch {
        if (forceInteraction) return fallbackForcedInterjection({ previousInterjections });
        return normalizeSystemDesignInterjection({ shouldInterrupt: false, reason: "interviewer_provider_unavailable" });
    }
};

export default generateSystemDesignInterjection;
