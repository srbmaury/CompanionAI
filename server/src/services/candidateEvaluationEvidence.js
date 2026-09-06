const clean = (value) => String(value || "").trim();

export const followUpEvidence = (item) => {
    if (Array.isArray(item?.followUps) && item.followUps.length) {
        return item.followUps
            .filter((followUp) => followUp?.question && followUp?.answer)
            .map((followUp, index) => `AI interviewer follow-up ${index + 1}: ${followUp.question}\nCandidate response ${index + 1}: ${followUp.answer}`)
            .join("\n\n");
    }
    return item?.followUpQuestion
        ? `AI interviewer probe: ${item.followUpQuestion}\nCandidate response: ${item.followUpAnswer || ""}`
        : "";
};

const fullDiscussionFallback = (item) => {
    const turns = Array.isArray(item?.discussionTurns) ? item.discussionTurns : [];
    if (!turns.length) return "";
    return ["Live interviewer discussion:", ...turns
        .filter((turn) => clean(turn?.text))
        .map((turn) => `${turn.speaker === "interviewer" ? "Interviewer" : "Candidate"}: ${clean(turn.text)}`)]
        .join("\n");
};

export const interviewerDiscussionEvidence = (item) => {
    const turns = Array.isArray(item?.discussionTurns) ? item.discussionTurns : [];
    const interviewerTurns = turns
        .filter((turn) => turn?.speaker === "interviewer" && clean(turn.text))
        .map((turn) => `Interviewer: ${clean(turn.text)}`);
    return interviewerTurns.length ? ["Live interviewer prompts:", ...interviewerTurns].join("\n") : "";
};

export const buildCandidateEvaluationEvidence = ({ item, systemDesign = false, diagramContext = "" }) => {
    const canonicalAnswer = clean(item?.answer);
    const answerEvidence = canonicalAnswer || (systemDesign ? fullDiscussionFallback(item) : "");
    return [
        answerEvidence,
        systemDesign ? interviewerDiscussionEvidence(item) : "",
        clean(diagramContext),
        item?.spokenExplanation ? `Spoken explanation:\n${clean(item.spokenExplanation)}` : "",
        followUpEvidence(item),
    ].filter(Boolean).join("\n\n");
};

export default buildCandidateEvaluationEvidence;
