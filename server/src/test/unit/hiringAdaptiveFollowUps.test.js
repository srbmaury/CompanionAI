import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import CandidateAttempt from "../../models/CandidateAttempt.js";
import { MAX_FOLLOW_UPS, normalizeFollowUpDecision } from "../../utils/generateQuestions/followUp.js";

const attemptWithFollowUps = (followUps) => new CandidateAttempt({
    assessment: new mongoose.Types.ObjectId(),
    candidateName: "Test Candidate",
    candidateEmail: "candidate@example.com",
    accessTokenHash: "hash",
    privacyConsentAt: new Date(),
    rounds: [{
        name: "Technical interview",
        deliveryMode: "conversational",
        adaptiveState: { enabled: true },
        questions: [{
            text: "How would you make this service resilient?",
            answer: "I would add retries and monitoring.",
            followUps,
        }],
    }],
});

describe("Hire adaptive follow-up budget", () => {
    it("shares the same hard maximum of three probes as Practice", () => {
        expect(MAX_FOLLOW_UPS).toBe(3);
        const valid = attemptWithFollowUps([
            { question: "What would you retry?", answer: "Transient failures." },
            { question: "How would you avoid retry storms?", answer: "Backoff and jitter." },
            { question: "What would you monitor?", answer: "Error rate and saturation." },
        ]);
        expect(valid.validateSync()).toBeUndefined();
    });

    it("rejects a fourth stored follow-up and stops generation when the budget is exhausted", () => {
        const invalid = attemptWithFollowUps([
            { question: "Probe 1", answer: "A" },
            { question: "Probe 2", answer: "B" },
            { question: "Probe 3", answer: "C" },
            { question: "Probe 4", answer: "D" },
        ]);
        expect(invalid.validateSync()?.errors?.["rounds.0.questions.0.followUps"]).toBeTruthy();
        expect(normalizeFollowUpDecision({ shouldAsk: true, followUp: "Another probe" }, 0)).toMatchObject({
            shouldAsk: false,
            followUp: null,
            reason: "probe_budget_exhausted",
        });
    });
});
