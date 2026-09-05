const normalize = (value = "") => value.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export function assessQuestionSet(form) {
    const questions = (form.rounds || []).flatMap((round) => round.questions || []).filter((question) => question.text?.trim());
    const normalized = questions.map((question) => normalize(question.text));
    const duplicates = normalized.filter((text, index) => text && normalized.indexOf(text) !== index).length;
    const competencies = [...new Set(questions.flatMap((question) => question.competencies || []).map((value) => value.trim()).filter(Boolean))];
    const withoutCompetencies = questions.filter((question) => !(question.competencies || []).length).length;
    const jdTerms = [...new Set(normalize(form.jobDescription).split(" ").filter((term) => term.length > 5))].slice(0, 30);
    const coveredTerms = jdTerms.filter((term) => normalized.some((question) => question.includes(term)));
    const targetMismatch = (form.rounds || []).filter((round) => {
        const configured = (round.questions || []).filter((question) => question.text?.trim()).length;
        const target = Number(round.questionCount) || 0;
        if (round.deliveryMode === "conversational" && round.adaptive !== false) return configured > target;
        return target !== configured;
    }).length;
    return {
        total: questions.length,
        duplicates,
        competencies,
        withoutCompetencies,
        targetMismatch,
        coverage: jdTerms.length ? Math.round(coveredTerms.length / jdTerms.length * 100) : 0,
    };
}
