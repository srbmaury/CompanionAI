export const ASSESSMENT_WIZARD_STEPS = [
    { key: "role", label: "Role" },
    { key: "plan", label: "Interview plan" },
    { key: "candidate", label: "Candidate setup" },
    { key: "review", label: "Review" },
];

export const parseCandidateEmails = (value = "") => value
    .split(/[\n,;]+/)
    .map((email) => email.trim())
    .filter(Boolean);

export const normalizeAssessmentRounds = (rounds = []) => rounds.map((round) => {
    const questions = (round.questions || [])
        .map((question) => ({
            text: question.text?.trim() || "",
            weight: Number(question.weight) || 1,
            competencies: question.competencies || [],
            knockout: Boolean(question.knockout),
            required: Boolean(question.required),
        }))
        .filter((question) => question.text);
    const requiredCount = questions.filter((question) => question.required).length;
    const fixedConversation = round.deliveryMode === "conversational" && round.adaptive === false;

    return {
        ...round,
        questions,
        questionCount: fixedConversation
            ? questions.length
            : Math.min(10, Math.max(Number(round.questionCount) || 1, requiredCount || 1)),
    };
});

export const assessmentStepIssue = (form, stepKey) => {
    if (stepKey === "role") {
        if (!form.jobRole?.trim()) return "Add the job role to continue.";
        if (!form.title?.trim()) return "Add an assessment name to continue.";
        if ((form.jobDescription?.trim()?.length || 0) < 20) return "Add a little more job context (at least 20 characters).";
        return "";
    }

    if (stepKey === "plan") {
        if (!form.rounds?.length) return "Add at least one interview round.";
        const missingQuestion = form.rounds.find((round) => !(round.questions || []).some((question) => question.text?.trim()));
        if (missingQuestion) return `Add or generate at least one question for ${missingQuestion.name || "each round"}.`;
        return "";
    }

    if (stepKey === "candidate") {
        if (Number(form.durationMinutes) < 5 || Number(form.durationMinutes) > 240) return "Choose an estimated duration between 5 and 240 minutes.";
        return "";
    }

    return "";
};

export const publishReadinessIssue = (form) => {
    for (const step of ASSESSMENT_WIZARD_STEPS.slice(0, 3)) {
        const issue = assessmentStepIssue(form, step.key);
        if (issue) return issue;
    }
    if (form.inviteOnly && parseCandidateEmails(form.inviteEmails).length === 0) {
        return "Add at least one candidate email or switch access to shareable link.";
    }
    return "";
};
