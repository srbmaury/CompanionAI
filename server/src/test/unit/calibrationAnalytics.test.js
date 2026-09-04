import { describe, expect, it } from "vitest";
import {
    adaptiveCoverage,
    computeReviewerAgreement,
    summarizeAdaptiveRounds,
    summarizeDecisionTraces,
} from "../../services/calibrationAnalytics.js";

describe("calibration analytics", () => {
    it("computes weighted adaptive coverage", () => {
        const coverage = adaptiveCoverage({ competencies: [
            { weight: 2, confidence: 0.72 },
            { weight: 1, confidence: 0.36 },
        ] });
        expect(coverage).toBeCloseTo(5 / 6, 4);
    });

    it("summarizes adaptive round efficiency and fallback usage", () => {
        const summary = summarizeAdaptiveRounds([
            {
                status: "completed",
                adaptiveState: {
                    enabled: true,
                    questionsAsked: 3,
                    maxQuestions: 5,
                    competencies: [{ weight: 1, confidence: 0.72 }],
                },
                questions: [
                    { sourceType: "adaptive", followUps: [{}, {}] },
                    { sourceType: "resume-claim", followUps: [] },
                    { sourceType: "fallback", followUps: [{}] },
                ],
            },
        ]);
        expect(summary).toMatchObject({
            rounds: 1,
            completed: 1,
            averageQuestions: 3,
            averageCoverage: 100,
            earlyStopRate: 100,
            fallbackQuestionRate: 33.3,
            resumeProbeRate: 100,
            averageFollowUpsPerQuestion: 1,
        });
    });

    it("computes reviewer agreement without candidate identifiers", () => {
        const agreement = computeReviewerAgreement([
            { overallScore: 8, reviewerScore: 7.5, reviewerDecision: "advance" },
            { overallScore: 6, reviewerScore: 7, reviewerDecision: "hold" },
            { overallScore: 4, reviewerScore: 5.5, reviewerDecision: "reject" },
        ]);
        expect(agreement.reviewedPairs).toBe(3);
        expect(agreement.meanAbsoluteError).toBe(1);
        expect(agreement.meanBias).toBeCloseTo(-0.7, 1);
        expect(agreement.withinOnePoint).toBeCloseTo(66.7, 1);
        expect(agreement.byDecision.advance).toMatchObject({ count: 1, averageAiScore: 8, averageHumanScore: 7.5 });
    });

    it("summarizes policy actions and bounded difficulty transitions", () => {
        const summary = summarizeDecisionTraces([
            { action: "next-question", difficultyFrom: 3, difficultyTo: 4, fallbackUsed: false, usedResumeClaim: true },
            { action: "next-question", difficultyFrom: 4, difficultyTo: 4, fallbackUsed: true, usedResumeClaim: false },
            { action: "end-round", difficultyFrom: 4, difficultyTo: 3, fallbackUsed: false, usedResumeClaim: false },
        ]);
        expect(summary).toMatchObject({
            total: 3,
            actions: { "next-question": 2, "end-round": 1 },
            difficultyTransitions: { "3→4": 1, "4→3": 1 },
            fallbackEvents: 1,
            resumeClaimEvents: 1,
        });
    });
});
