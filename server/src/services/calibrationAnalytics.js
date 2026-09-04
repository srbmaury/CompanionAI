import AdaptiveInterviewTrace from "../models/AdaptiveInterviewTrace.js";
import CandidateAttempt from "../models/CandidateAttempt.js";
import Round from "../models/Round.js";

const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;
const percent1 = (value) => Math.round((Number(value) || 0) * 1000) / 10;

export const adaptiveCoverage = (state) => {
    const competencies = Array.isArray(state?.competencies) ? state.competencies : [];
    if (!competencies.length) return 0;
    let weighted = 0;
    let total = 0;
    for (const item of competencies) {
        const weight = Math.max(0.1, Number(item?.weight) || 1);
        const confidence = Math.max(0, Math.min(1, Number(item?.confidence) || 0));
        weighted += weight * Math.min(1, confidence / 0.72);
        total += weight;
    }
    return total ? weighted / total : 0;
};

export const summarizeAdaptiveRounds = (rounds = []) => {
    const adaptive = (rounds || []).filter((round) => round?.adaptiveState?.enabled);
    if (!adaptive.length) {
        return {
            rounds: 0,
            completed: 0,
            averageQuestions: 0,
            averageCoverage: 0,
            earlyStopRate: 0,
            fallbackQuestionRate: 0,
            resumeProbeRate: 0,
            averageFollowUpsPerQuestion: 0,
        };
    }

    let completed = 0;
    let questions = 0;
    let completedQuestions = 0;
    let coverage = 0;
    let earlyStops = 0;
    let fallbackQuestions = 0;
    let resumeProbeRounds = 0;
    let followUps = 0;

    for (const round of adaptive) {
        const asked = Number(round?.adaptiveState?.questionsAsked) || round?.questions?.length || 0;
        questions += asked;
        coverage += adaptiveCoverage(round.adaptiveState);
        const roundQuestions = Array.isArray(round?.questions) ? round.questions : [];
        fallbackQuestions += roundQuestions.filter((item) => item?.sourceType === "fallback").length;
        followUps += roundQuestions.reduce((sum, item) => sum + (Array.isArray(item?.followUps) ? item.followUps.length : 0), 0);
        if (roundQuestions.some((item) => item?.sourceType === "resume-claim")) resumeProbeRounds += 1;
        if (round?.status === "completed") {
            completed += 1;
            completedQuestions += asked;
            if (asked < (Number(round?.adaptiveState?.maxQuestions) || asked)) earlyStops += 1;
        }
    }

    return {
        rounds: adaptive.length,
        completed,
        averageQuestions: round1(questions / adaptive.length),
        averageCompletedQuestions: completed ? round1(completedQuestions / completed) : 0,
        averageCoverage: percent1(coverage / adaptive.length),
        earlyStopRate: completed ? percent1(earlyStops / completed) : 0,
        fallbackQuestionRate: questions ? percent1(fallbackQuestions / questions) : 0,
        resumeProbeRate: percent1(resumeProbeRounds / adaptive.length),
        averageFollowUpsPerQuestion: questions ? Math.round((followUps / questions) * 100) / 100 : 0,
    };
};

const correlation = (pairs) => {
    if (pairs.length < 2) return null;
    const meanX = pairs.reduce((sum, pair) => sum + pair.ai, 0) / pairs.length;
    const meanY = pairs.reduce((sum, pair) => sum + pair.human, 0) / pairs.length;
    let numerator = 0;
    let xx = 0;
    let yy = 0;
    for (const pair of pairs) {
        const dx = pair.ai - meanX;
        const dy = pair.human - meanY;
        numerator += dx * dy;
        xx += dx * dx;
        yy += dy * dy;
    }
    if (!xx || !yy) return null;
    return Math.round((numerator / Math.sqrt(xx * yy)) * 100) / 100;
};

export const computeReviewerAgreement = (attempts = []) => {
    const pairs = (attempts || [])
        .map((attempt) => ({
            ai: Number(attempt?.overallScore),
            human: Number(attempt?.reviewerScore),
            decision: attempt?.reviewerDecision || "unreviewed",
        }))
        .filter((pair) => Number.isFinite(pair.ai) && Number.isFinite(pair.human));

    if (!pairs.length) {
        return { reviewedPairs: 0, meanAbsoluteError: null, meanBias: null, withinHalfPoint: 0, withinOnePoint: 0, withinTwoPoints: 0, correlation: null, byDecision: {} };
    }

    const deltas = pairs.map((pair) => pair.ai - pair.human);
    const absolute = deltas.map(Math.abs);
    const byDecision = {};
    for (const pair of pairs) {
        const key = pair.decision || "unreviewed";
        byDecision[key] ||= { count: 0, aiTotal: 0, humanTotal: 0 };
        byDecision[key].count += 1;
        byDecision[key].aiTotal += pair.ai;
        byDecision[key].humanTotal += pair.human;
    }
    for (const value of Object.values(byDecision)) {
        value.averageAiScore = round1(value.aiTotal / value.count);
        value.averageHumanScore = round1(value.humanTotal / value.count);
        delete value.aiTotal;
        delete value.humanTotal;
    }

    return {
        reviewedPairs: pairs.length,
        meanAbsoluteError: round1(absolute.reduce((sum, value) => sum + value, 0) / pairs.length),
        meanBias: round1(deltas.reduce((sum, value) => sum + value, 0) / pairs.length),
        withinHalfPoint: percent1(absolute.filter((value) => value <= 0.5).length / pairs.length),
        withinOnePoint: percent1(absolute.filter((value) => value <= 1).length / pairs.length),
        withinTwoPoints: percent1(absolute.filter((value) => value <= 2).length / pairs.length),
        correlation: correlation(pairs),
        byDecision,
    };
};

export const summarizeDecisionTraces = (traces = []) => {
    const transitions = {};
    const actions = {};
    let fallbackEvents = 0;
    let resumeClaimEvents = 0;
    for (const trace of traces || []) {
        if (trace?.action) actions[trace.action] = (actions[trace.action] || 0) + 1;
        if (trace?.fallbackUsed) fallbackEvents += 1;
        if (trace?.usedResumeClaim) resumeClaimEvents += 1;
        const from = Number(trace?.difficultyFrom);
        const to = Number(trace?.difficultyTo);
        if (Number.isFinite(from) && Number.isFinite(to) && from !== to) {
            const key = `${from}→${to}`;
            transitions[key] = (transitions[key] || 0) + 1;
        }
    }
    return { total: traces.length, actions, difficultyTransitions: transitions, fallbackEvents, resumeClaimEvents };
};

export const getCalibrationSnapshot = async ({ limit = 500 } = {}) => {
    const bounded = Math.min(Math.max(Number(limit) || 500, 50), 2000);
    const [rounds, traces, attempts] = await Promise.all([
        Round.find({ "adaptiveState.enabled": true }).sort({ _id: -1 }).limit(bounded).lean(),
        AdaptiveInterviewTrace.find({}).sort({ createdAt: -1 }).limit(bounded * 4).lean(),
        CandidateAttempt.find({ overallScore: { $type: "number" }, reviewerScore: { $type: "number" } })
            .select("overallScore reviewerScore reviewerDecision reviewedAt")
            .sort({ reviewedAt: -1 })
            .limit(bounded)
            .lean(),
    ]);

    return {
        sampleLimit: bounded,
        adaptive: summarizeAdaptiveRounds(rounds),
        decisions: summarizeDecisionTraces(traces),
        reviewerAgreement: computeReviewerAgreement(attempts),
        recentTraces: traces.slice(0, 75).map((trace) => ({
            eventType: trace.eventType,
            action: trace.action,
            targetCompetency: trace.targetCompetency,
            sourceType: trace.sourceType,
            usedResumeClaim: trace.usedResumeClaim,
            fallbackUsed: trace.fallbackUsed,
            questionCount: trace.questionCount,
            questionsAsked: trace.questionsAsked,
            followUpCount: trace.followUpCount,
            difficultyFrom: trace.difficultyFrom,
            difficultyTo: trace.difficultyTo,
            coverageBefore: percent1(trace.coverageBefore),
            coverageAfter: percent1(trace.coverageAfter),
            averageConfidenceBefore: percent1(trace.averageConfidenceBefore),
            averageConfidenceAfter: percent1(trace.averageConfidenceAfter),
            engineVersion: trace.engineVersion,
            promptVersion: trace.promptVersion,
            reason: trace.reason,
            createdAt: trace.createdAt,
        })),
    };
};
