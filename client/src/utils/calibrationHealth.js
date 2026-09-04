const numberOrNull = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

export const calibrationHealth = (data = {}) => {
    const agreement = data?.reviewerAgreement || {};
    const adaptive = data?.adaptive || {};
    const reviewedPairs = Number(agreement.reviewedPairs) || 0;
    const completedAdaptiveRounds = Number(adaptive.completed) || 0;
    const signals = [];

    if (reviewedPairs >= 20) {
        const mae = numberOrNull(agreement.meanAbsoluteError);
        const bias = numberOrNull(agreement.meanBias);
        const overTwo = numberOrNull(agreement.overTwoPoints);
        if (mae != null && mae > 1.5) signals.push({ key: "reviewer-mae", severity: "warning", title: "Reviewer agreement is weak", detail: `Mean absolute error is ${mae.toFixed(1)} points; investigate the largest disagreement cases before expanding automated scoring.` });
        if (bias != null && Math.abs(bias) > 1) signals.push({ key: "reviewer-bias", severity: "warning", title: bias > 0 ? "AI scores are systematically high" : "AI scores are systematically low", detail: `Mean AI-minus-human bias is ${bias > 0 ? "+" : ""}${bias.toFixed(1)} points.` });
        if (overTwo != null && overTwo > 20) signals.push({ key: "reviewer-tail", severity: "warning", title: "Too many large score disagreements", detail: `${overTwo.toFixed(1)}% of reviewed attempts differ by more than two points.` });
    }

    if (completedAdaptiveRounds >= 20) {
        const fallbackRate = numberOrNull(adaptive.fallbackQuestionRate);
        const coverage = numberOrNull(adaptive.averageCoverage);
        if (fallbackRate != null && fallbackRate > 10) signals.push({ key: "fallback-rate", severity: "warning", title: "Adaptive fallback rate is elevated", detail: `${fallbackRate.toFixed(1)}% of adaptive questions used fallback generation. Check provider reliability and prompt failure patterns.` });
        if (coverage != null && coverage < 75) signals.push({ key: "coverage", severity: "warning", title: "Adaptive competency coverage is low", detail: `Completed adaptive rounds average ${coverage.toFixed(1)}% weighted coverage.` });
    }

    const hasUsefulSample = reviewedPairs >= 20 || completedAdaptiveRounds >= 20;
    return {
        status: signals.length ? "attention" : hasUsefulSample ? "stable" : "collecting",
        signals,
    };
};

export default calibrationHealth;
