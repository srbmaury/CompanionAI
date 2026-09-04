import { describe, expect, it } from "vitest";
import { MAX_FOLLOW_UPS, normalizeFollowUpDecision } from "../../utils/generateQuestions/followUp.js";
import { buildFallbackRoundPlan, detectInterviewProfile, sanitizeRoundPlan } from "../../utils/interviewRounds.js";

describe("adaptive interview intelligence", () => {
    it("never exceeds the follow-up budget", () => {
        expect(MAX_FOLLOW_UPS).toBe(3);
        expect(normalizeFollowUpDecision({ shouldAsk: true, followUp: "One more?" }, 0)).toEqual({
            shouldAsk: false,
            followUp: null,
            reason: "probe_budget_exhausted",
            focus: null,
        });
    });

    it("keeps a valid high-signal follow-up decision", () => {
        expect(normalizeFollowUpDecision({
            shouldAsk: true,
            followUp: "What failure mode made you choose at-least-once delivery?",
            reason: "validate trade-off",
            focus: "reliability",
        }, 2)).toMatchObject({
            shouldAsk: true,
            focus: "reliability",
        });
    });

    it("detects senior backend architecture signal", () => {
        expect(detectInterviewProfile("Senior Backend Engineer", "Own distributed services, scalability, APIs and reliability"))
            .toMatchObject({ family: "backend", seniority: "senior", architectureHeavy: true });
    });

    it("builds role-aware fallback plans instead of HR/technical/manager boilerplate", () => {
        const frontend = buildFallbackRoundPlan("Frontend Engineer", "React, accessibility, performance and testing");
        expect(frontend.map((round) => round.roundName)).toContain("Frontend Architecture");
        expect(frontend.map((round) => round.roundName)).not.toContain("HR Screening");

        const manager = buildFallbackRoundPlan("Engineering Manager", "Lead teams, architecture, mentoring and delivery");
        expect(manager[0].roundName).toBe("Technical Strategy");
        expect(manager.some((round) => round.roundName === "Coding & Problem Solving")).toBe(false);
    });

    it("preserves AI delivery mode, skills and recommendation metadata while clamping counts", () => {
        const fallback = buildFallbackRoundPlan("Backend Engineer", "APIs and databases");
        const rounds = sanitizeRoundPlan([
            {
                roundName: "API Design",
                description: "Probe API and data trade-offs.",
                deliveryMode: "conversational",
                questionLimit: 99,
                skills: ["APIs", "data modeling"],
                rationale: "Core role responsibility",
                recommended: false,
            },
            {
                roundName: "Failure Modes",
                description: "Probe reliability decisions and production failure handling.",
                deliveryMode: "conversational",
                questionLimit: 4,
                skills: ["reliability"],
                rationale: "Important production responsibility",
                recommended: true,
            },
        ], fallback);
        expect(rounds).toHaveLength(2);
        expect(rounds[0]).toMatchObject({ roundName: "API Design", questionLimit: 10, recommended: false });
        expect(rounds[1]).toMatchObject({ roundName: "Failure Modes", recommended: true });
    });
});
