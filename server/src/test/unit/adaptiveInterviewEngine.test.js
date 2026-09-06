import { describe, expect, it } from "vitest";
import {
    adaptiveCoverageRatio,
    applyEvidenceToState,
    buildDeterministicAdaptiveQuestion,
    chooseNextCompetency,
    extractResumeClaimsFallback,
    initializeAdaptiveInterviewState,
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

    it("keeps system design as one resume-independent discussion problem", async () => {
        const designState = await initializeAdaptiveInterviewState({
            jobRole: "Senior Backend Engineer",
            jobDescription: "Build scalable distributed services.",
            roundName: "System Design",
            roundDescription: "Design a production system and defend trade-offs.",
            skills: ["system design", "scalability"],
            resumeText: "Architected an offline runtime that reduced startup latency by 90%.",
            maxQuestions: 5,
        });
        expect(designState.enabled).toBe(false);
        expect(designState.minQuestions).toBe(1);
        expect(designState.maxQuestions).toBe(1);
        expect(designState.resumeClaims).toEqual([]);

        const question = buildDeterministicAdaptiveQuestion({
            round: { name: "System Design", description: "Design a production service." },
            state: designState,
            targetCompetency: "Architecture",
            difficulty: 4,
            sourceClaim: "Architected an offline runtime that reduced startup latency by 90%.",
        });
        expect(question.text).toMatch(/^Design /);
        expect(question.text).not.toMatch(/offline|90%/i);
        expect(question.sourceClaim).toBe("");
        expect(question.sourceType).toBe("fallback");
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

    it("enforces at most one difficulty step per completed question", () => {
        const increased = applyEvidenceToState(state({ currentDifficulty: 2 }), {
            competencyEvidence: [],
            policy: { action: "next-question", difficulty: 5 },
        }, { questionIndex: 0 });
        expect(increased.currentDifficulty).toBe(3);

        const decreased = applyEvidenceToState(state({ currentDifficulty: 4 }), {
            competencyEvidence: [],
            policy: { action: "next-question", difficulty: 1 },
        }, { questionIndex: 0 });
        expect(decreased.currentDifficulty).toBe(3);
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

    it("caps resume-claim base questions so the round still covers role competencies", () => {
        const capped = state({
            resumeClaims: [
                { claim: "Claim one", topics: ["APIs"], probeAreas: [], probeCount: 1, covered: false },
                { claim: "Claim two", topics: ["APIs"], probeAreas: [], probeCount: 1, covered: false },
                { claim: "Claim three", topics: ["APIs"], probeAreas: [], probeCount: 0, covered: false },
            ],
        });
        expect(selectResumeClaimForTarget(capped, "APIs")).toBeNull();
    });

    it("builds a useful deterministic question when providers are unavailable", () => {
        const first = buildDeterministicAdaptiveQuestion({
            round: { name: "Backend Deep Dive", description: "APIs, reliability, production trade-offs" },
            state: state({ questionsAsked: 0 }),
            targetCompetency: "Reliability",
            difficulty: 3,
        });
        const second = buildDeterministicAdaptiveQuestion({
            round: { name: "Backend Deep Dive", description: "APIs, reliability, production trade-offs" },
            state: state({ questionsAsked: 1 }),
            targetCompetency: "Reliability",
            difficulty: 3,
        });
        expect(first.text.length).toBeGreaterThan(20);
        expect(first.competencies).toEqual(["Reliability"]);
        expect(first.sourceType).toBe("fallback");
        expect(second.text).not.toBe(first.text);
    });

    it("builds degraded-mode resume probes from the actual claim", () => {
        const claim = "Reduced deployment time by 90%";
        const question = buildDeterministicAdaptiveQuestion({
            round: { name: "Technical Deep Dive" },
            state: state({ resumeClaims: [{ claim, probeCount: 0, covered: false }] }),
            targetCompetency: "APIs",
            difficulty: 4,
            sourceClaim: claim,
        });
        expect(question.text).toContain("90%");
        expect(question.text).toMatch(/specific technical contribution/i);
        expect(question.sourceType).toBe("resume-claim");
    });
});
