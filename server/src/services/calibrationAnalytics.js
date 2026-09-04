import AdaptiveInterviewTrace from "../models/AdaptiveInterviewTrace.js";
import Assessment from "../models/Assessment.js";
import CandidateAttempt from "../models/CandidateAttempt.js";
import Interview from "../models/Interview.js";
import Round from "../models/Round.js";

const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;
const percent1 = (value) => Math.round((Number(value) || 0) * 1000) / 10;
const normalizeKey = (value) => (value || "").toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

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
            averageCompletedQuestions: 0,
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

const percentile = (values, fraction) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
    return round1(sorted[index]);
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
        return {
            reviewedPairs: 0,
            meanAbsoluteError: null,
            medianAbsoluteError: null,
            p90AbsoluteError: null,
            meanBias: null,
            withinHalfPoint: 0,
            withinOnePoint: 0,
            withinTwoPoints: 0,
            overTwoPoints: 0,
            correlation: null,
            byDecision: {},
        };
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
        medianAbsoluteError: percentile(absolute, 0.5),
        p90AbsoluteError: percentile(absolute, 0.9),
        meanBias: round1(deltas.reduce((sum, value) => sum + value, 0) / pairs.length),
        withinHalfPoint: percent1(absolute.filter((value) => value <= 0.5).length / pairs.length),
        withinOnePoint: percent1(absolute.filter((value) => value <= 1).length / pairs.length),
        withinTwoPoints: percent1(absolute.filter((value) => value <= 2).length / pairs.length),
        overTwoPoints: percent1(absolute.filter((value) => value > 2).length / pairs.length),
        correlation: correlation(pairs),
        byDecision,
    };
};

export const computeCriterionAgreement = (attempts = []) => {
    const grouped = new Map();
    let matchedRatings = 0;

    for (const attempt of attempts || []) {
        const aiByCriterion = new Map();
        for (const round of attempt?.rounds || []) {
            for (const question of round?.questions || []) {
                const aiScore = Number(question?.score);
                if (!Number.isFinite(aiScore)) continue;
                for (const competency of question?.competencies || []) {
                    const key = normalizeKey(competency);
                    if (!key) continue;
                    const current = aiByCriterion.get(key) || { label: competency, total: 0, count: 0 };
                    current.total += aiScore;
                    current.count += 1;
                    aiByCriterion.set(key, current);
                }
            }
        }

        for (const rating of attempt?.reviewerRatings || []) {
            const humanScore = Number(rating?.score);
            const key = normalizeKey(rating?.criterion);
            const ai = aiByCriterion.get(key);
            if (!key || !ai || !Number.isFinite(humanScore)) continue;
            const aiScore = ai.total / ai.count;
            const entry = grouped.get(key) || { criterion: rating.criterion || ai.label, pairs: [] };
            entry.pairs.push({ ai: aiScore, human: humanScore });
            grouped.set(key, entry);
            matchedRatings += 1;
        }
    }

    const byCriterion = [...grouped.values()].map((entry) => {
        const deltas = entry.pairs.map((pair) => pair.ai - pair.human);
        const absolute = deltas.map(Math.abs);
        return {
            criterion: entry.criterion,
            count: entry.pairs.length,
            averageAiScore: round1(entry.pairs.reduce((sum, pair) => sum + pair.ai, 0) / entry.pairs.length),
            averageHumanScore: round1(entry.pairs.reduce((sum, pair) => sum + pair.human, 0) / entry.pairs.length),
            meanAbsoluteError: round1(absolute.reduce((sum, value) => sum + value, 0) / entry.pairs.length),
            meanBias: round1(deltas.reduce((sum, value) => sum + value, 0) / entry.pairs.length),
        };
    }).sort((a, b) => b.count - a.count || b.meanAbsoluteError - a.meanAbsoluteError);

    return { matchedRatings, byCriterion };
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

export const summarizePromptVersions = (traces = []) => {
    const grouped = new Map();
    for (const trace of traces || []) {
        const promptVersion = trace?.promptVersion || "unknown";
        const item = grouped.get(promptVersion) || { promptVersion, events: 0, completed: 0, fallbackEvents: 0, resumeClaimEvents: 0, difficultyChanges: 0 };
        item.events += 1;
        if (trace?.eventType === "completed") item.completed += 1;
        if (trace?.fallbackUsed) item.fallbackEvents += 1;
        if (trace?.usedResumeClaim) item.resumeClaimEvents += 1;
        if (Number(trace?.difficultyFrom) !== Number(trace?.difficultyTo)) item.difficultyChanges += 1;
        grouped.set(promptVersion, item);
    }
    return [...grouped.values()].sort((a, b) => b.events - a.events);
};

export const buildDisagreementQueue = (attempts = [], assessmentById = new Map(), threshold = 1.5) => (attempts || [])
    .map((attempt) => {
        const aiScore = Number(attempt?.overallScore);
        const humanScore = Number(attempt?.reviewerScore);
        if (!Number.isFinite(aiScore) || !Number.isFinite(humanScore)) return null;
        const assessment = assessmentById.get(String(attempt?.assessment)) || {};
        const delta = round1(aiScore - humanScore);
        return {
            attemptId: String(attempt?._id || ""),
            assessmentId: String(attempt?.assessment || ""),
            assessmentTitle: assessment.title || "",
            jobRole: assessment.jobRole || "",
            aiScore: round1(aiScore),
            humanScore: round1(humanScore),
            delta,
            absoluteDelta: round1(Math.abs(delta)),
            reviewerDecision: attempt?.reviewerDecision || "unreviewed",
            reviewedAt: attempt?.reviewedAt || null,
        };
    })
    .filter((item) => item && item.absoluteDelta >= threshold)
    .sort((a, b) => b.absoluteDelta - a.absoluteDelta || new Date(b.reviewedAt || 0) - new Date(a.reviewedAt || 0))
    .slice(0, 30);

const groupReviewerByRole = (attempts, assessmentById) => {
    const grouped = new Map();
    for (const attempt of attempts || []) {
        const assessment = assessmentById.get(String(attempt?.assessment));
        const role = (assessment?.jobRole || "Unknown role").trim() || "Unknown role";
        if (!grouped.has(role)) grouped.set(role, []);
        grouped.get(role).push(attempt);
    }
    return [...grouped.entries()]
        .map(([jobRole, rows]) => ({ jobRole, ...computeReviewerAgreement(rows) }))
        .sort((a, b) => b.reviewedPairs - a.reviewedPairs)
        .slice(0, 20);
};

const groupAdaptiveRounds = (rounds, roleByRound) => {
    const byRole = new Map();
    const byRoundName = new Map();
    for (const round of rounds || []) {
        const role = roleByRound.get(String(round?._id)) || "Unknown role";
        const roundName = (round?.name || "Unnamed round").trim() || "Unnamed round";
        if (!byRole.has(role)) byRole.set(role, []);
        if (!byRoundName.has(roundName)) byRoundName.set(roundName, []);
        byRole.get(role).push(round);
        byRoundName.get(roundName).push(round);
    }
    const materialize = (map, keyName) => [...map.entries()]
        .map(([key, values]) => ({ [keyName]: key, ...summarizeAdaptiveRounds(values) }))
        .sort((a, b) => b.rounds - a.rounds)
        .slice(0, 20);
    return { byRole: materialize(byRole, "jobRole"), byRound: materialize(byRoundName, "roundName") };
};

export const getCalibrationSnapshot = async ({ limit = 500 } = {}) => {
    const bounded = Math.min(Math.max(Number(limit) || 500, 50), 2000);
    const [rounds, traces, attempts] = await Promise.all([
        Round.find({ "adaptiveState.enabled": true }).sort({ _id: -1 }).limit(bounded).lean(),
        AdaptiveInterviewTrace.find({}).sort({ createdAt: -1 }).limit(bounded * 4).lean(),
        CandidateAttempt.find({ overallScore: { $type: "number" }, reviewerScore: { $type: "number" } })
            .select("assessment overallScore reviewerScore reviewerDecision reviewerRatings reviewedAt rounds.name rounds.questions.score rounds.questions.competencies")
            .sort({ reviewedAt: -1 })
            .limit(bounded)
            .lean(),
    ]);

    const roundIds = rounds.map((round) => round._id);
    const assessmentIds = [...new Set(attempts.map((attempt) => String(attempt.assessment)).filter(Boolean))];
    const [interviews, assessments] = await Promise.all([
        roundIds.length ? Interview.find({ "rounds.round": { $in: roundIds } }).select("jobRole rounds.round").lean() : [],
        assessmentIds.length ? Assessment.find({ _id: { $in: assessmentIds } }).select("title jobRole").lean() : [],
    ]);

    const roleByRound = new Map();
    for (const interview of interviews) {
        for (const entry of interview?.rounds || []) roleByRound.set(String(entry.round), interview.jobRole || "Unknown role");
    }
    const roundById = new Map(rounds.map((round) => [String(round._id), round]));
    const assessmentById = new Map(assessments.map((assessment) => [String(assessment._id), assessment]));
    const reviewerAgreement = computeReviewerAgreement(attempts);
    const adaptiveSegments = groupAdaptiveRounds(rounds, roleByRound);

    return {
        sampleLimit: bounded,
        calibrationReadiness: reviewerAgreement.reviewedPairs < 20 ? "collecting" : reviewerAgreement.reviewedPairs < 100 ? "directional" : "larger_sample",
        adaptive: summarizeAdaptiveRounds(rounds),
        adaptiveByRole: adaptiveSegments.byRole,
        adaptiveByRound: adaptiveSegments.byRound,
        decisions: summarizeDecisionTraces(traces),
        promptVersions: summarizePromptVersions(traces),
        reviewerAgreement: {
            ...reviewerAgreement,
            byJobRole: groupReviewerByRole(attempts, assessmentById),
            criteria: computeCriterionAgreement(attempts),
        },
        disagreements: buildDisagreementQueue(attempts, assessmentById),
        recentTraces: traces.slice(0, 100).map((trace) => {
            const round = roundById.get(String(trace.round));
            return {
                eventType: trace.eventType,
                action: trace.action,
                jobRole: roleByRound.get(String(trace.round)) || "Unknown role",
                roundName: round?.name || "Unknown round",
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
            };
        }),
    };
};
