import { describe, expect, it } from "vitest";
import {
    adaptiveCoverage,
    buildDisagreementQueue,
    computeCriterionAgreement,
    computeReviewerAgreement,
    summarizeAdaptiveRounds,
    summarizeDecisionTraces,
    summarizePromptVersions,
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

    it("computes reviewer agreement and tail disagreement metrics", () => {
        const agreement = computeReviewerAgreement([
            { overallScore: 8, reviewerScore: 7.5, reviewerDecision: "advance" },
            { overallScore: 6, reviewerScore: 7, reviewerDecision: "hold" },
            { overallScore: 4, reviewerScore: 5.5, reviewerDecision: "reject" },
        ]);
        expect(agreement.reviewedPairs).toBe(3);
        expect(agreement.meanAbsoluteError).toBe(1);
        expect(agreement.medianAbsoluteError).toBe(1);
        expect(agreement.p90AbsoluteError).toBe(1.5);
        expect(agreement.meanBias).toBeCloseTo(-0.7, 1);
        expect(agreement.withinOnePoint).toBeCloseTo(66.7, 1);
        expect(agreement.byDecision.advance).toMatchObject({ count: 1, averageAiScore: 8, averageHumanScore: 7.5 });
    });

    it("matches human rubric ratings to AI competency evidence without candidate identifiers", () => {
        const agreement = computeCriterionAgreement([
            {
                reviewerRatings: [
                    { criterion: "System Design", score: 7 },
                    { criterion: "Communication", score: 8 },
                ],
                rounds: [{ questions: [
                    { score: 8, competencies: ["System Design"] },
                    { score: 6, competencies: ["System Design", "Communication"] },
                    { score: 8, competencies: ["Communication"] },
                ] }],
            },
        ]);
        expect(agreement.matchedRatings).toBe(2);
        expect(agreement.byCriterion).toEqual(expect.arrayContaining([
            expect.objectContaining({ criterion: "System Design", count: 1, averageAiScore: 7, averageHumanScore: 7, meanAbsoluteError: 0 }),
            expect.objectContaining({ criterion: "Communication", count: 1, averageAiScore: 7, averageHumanScore: 8, meanAbsoluteError: 1 }),
        ]));
    });

    it("surfaces the largest AI-human disagreements without names or emails", () => {
        const assessments = new Map([["a1", { title: "Backend", jobRole: "Backend Engineer" }]]);
        const queue = buildDisagreementQueue([
            { _id: "x1", assessment: "a1", overallScore: 9, reviewerScore: 5, reviewerDecision: "hold", reviewedAt: new Date("2026-09-01") },
            { _id: "x2", assessment: "a1", overallScore: 7, reviewerScore: 6.5, reviewerDecision: "advance", reviewedAt: new Date("2026-09-02") },
        ], assessments, 1.5);
        expect(queue).toHaveLength(1);
        expect(queue[0]).toMatchObject({ attemptId: "x1", jobRole: "Backend Engineer", aiScore: 9, humanScore: 5, absoluteDelta: 4 });
        expect(queue[0]).not.toHaveProperty("candidateName");
        expect(queue[0]).not.toHaveProperty("candidateEmail");
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

    it("separates adaptive behavior by prompt version", () => {
        const versions = summarizePromptVersions([
            { promptVersion: "v1", eventType: "completed", fallbackUsed: false, usedResumeClaim: true, difficultyFrom: 3, difficultyTo: 4 },
            { promptVersion: "v1", eventType: "question_selected", fallbackUsed: true, usedResumeClaim: false, difficultyFrom: 4, difficultyTo: 4 },
            { promptVersion: "v2", eventType: "completed", fallbackUsed: false, usedResumeClaim: false, difficultyFrom: 3, difficultyTo: 3 },
        ]);
        expect(versions[0]).toMatchObject({ promptVersion: "v1", events: 2, completed: 1, fallbackEvents: 1, resumeClaimEvents: 1, difficultyChanges: 1 });
        expect(versions[1]).toMatchObject({ promptVersion: "v2", events: 1, completed: 1 });
    });
});
