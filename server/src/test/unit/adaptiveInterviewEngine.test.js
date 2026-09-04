import { describe, expect, it } from "vitest";
import {
    adaptiveCoverageRatio,
    applyEvidenceToState,
    chooseNextCompetency,
    extractResumeClaimsFallback,
    selectResumeClaimForTarget,
    shouldStopAdaptiveRound,
} from "../../services/adaptiveInterviewEngine.js";

const state = (overrides = {}) => ({
    enabled: true,
    minQuestions: 2,
    maxQuestions: 5,
    currentDifficulty: 3,
    questionsAsked: 0,
    competencies: [
        { name: "APIs", weight: 1.5, scoreEstimate: null, confidence: 0, evidenceCount: 0, coverage: "uncovered", evidence: [] },
        { name: "Reliability", weight: 1, scoreEstimate: null, confidence: 0, evidenceCount: 0, coverage: "uncovered", evidence: [] },
    ],
    resumeClaims: [],
    ...overrides,
});

describe("adaptive interview engine", () => {
    it("extracts high-signal resume claims without inventing content", () => {
        const claims = extractResumeClaimsFallback("Built a cache migration that reduced memory footprint by 60%.\nWorked with the team.\nLed an API redesign handling 10M requests/day.");
        expect(claims).toHaveLength(2);
        expect(claims[0].claim).toMatch(/60%|10M/);
        expect(claims.every((claim) => claim.probeAreas.length > 0)).toBe(true);
    });

    it("updates competency score, confidence and bounded evidence", () => {
        const updated = applyEvidenceToState(state(), {
            confidence: 0.8,
            competencyEvidence: [{ name: "APIs", score: 8, confidence: 0.8, evidence: ["Explained idempotency and versioning trade-offs."] }],
            policy: { action: "next-question", targetCompetency: "Reliability", difficulty: 4, confidence: 0.8, reason: "Need failure evidence" },
        }, { questionIndex: 0, targetedCompetencies: ["APIs"] });
        expect(updated.questionsAsked).toBe(1);
        expect(updated.currentDifficulty).toBe(4);
        expect(updated.competencies[0]).toMatchObject({ scoreEstimate: 8, evidenceCount: 1, coverage: "partial" });
        expect(updated.competencies[0].confidence).toBeGreaterThan(0.5);
        expect(updated.competencies[0].evidence[0].text).toContain("idempotency");
    });

    it("targets the highest-weight uncertain competency", () => {
        const target = chooseNextCompetency(state({ competencies: [
            { name: "APIs", weight: 1.5, confidence: 0.2, scoreEstimate: 8 },
            { name: "Reliability", weight: 1, confidence: 0.75, scoreEstimate: 5 },
        ] }));
        expect(target).toBe("APIs");
    });

    it("never ends before the minimum sample even when AI asks to stop", () => {
        const result = shouldStopAdaptiveRound(state({ questionsAsked: 1 }), { policy: { action: "end-round", reason: "Enough" } });
        expect(result.stop).toBe(false);
    });

    it("hard-stops at the maximum question budget", () => {
        const result = shouldStopAdaptiveRound(state({ questionsAsked: 5 }), { policy: { action: "next-question" } });
        expect(result).toMatchObject({ stop: true });
        expect(result.reason).toMatch(/Maximum/);
    });

    it("allows early completion only after broad high-confidence coverage", () => {
        const covered = state({
            questionsAsked: 3,
            competencies: [
                { name: "APIs", weight: 1.5, confidence: 0.82, evidenceCount: 2, scoreEstimate: 8, coverage: "covered" },
                { name: "Reliability", weight: 1, confidence: 0.78, evidenceCount: 2, scoreEstimate: 7, coverage: "covered" },
            ],
        });
        expect(adaptiveCoverageRatio(covered)).toBeGreaterThan(0.9);
        expect(shouldStopAdaptiveRound(covered, { policy: { action: "end-round", reason: "Sufficient evidence" } })).toMatchObject({ stop: true });
    });

    it("prefers an unvalidated resume claim and marks it covered after strong evidence", () => {
        const initial = state({
            resumeClaims: [{ claim: "Reduced deployment time by 90%", topics: ["APIs"], probeAreas: ["measurement"], probeCount: 0, covered: false }],
        });
        expect(selectResumeClaimForTarget(initial, "APIs")?.claim).toContain("90%");
        const updated = applyEvidenceToState(initial, {
            confidence: 0.8,
            competencyEvidence: [{ name: "APIs", score: 7, confidence: 0.8, evidence: ["Explained the measurement baseline."] }],
            policy: { action: "next-question", targetCompetency: "Reliability", difficulty: 3, confidence: 0.8 },
        }, { questionIndex: 0, targetedCompetencies: ["APIs"], sourceClaim: "Reduced deployment time by 90%" });
        expect(updated.resumeClaims[0]).toMatchObject({ probeCount: 1, covered: true });
    });
});
