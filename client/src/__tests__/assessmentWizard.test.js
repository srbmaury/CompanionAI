import { describe, expect, it } from "vitest";
import {
    assessmentStepIssue,
    normalizeAssessmentRounds,
    parseCandidateEmails,
    publishReadinessIssue,
} from "../utils/assessmentWizard";

const form = (overrides = {}) => ({
    title: "Backend Engineer Assessment",
    jobRole: "Backend Engineer",
    jobDescription: "Design reliable backend systems and explain production tradeoffs.",
    durationMinutes: 30,
    inviteOnly: false,
    inviteEmails: "",
    rounds: [{
        name: "Technical interview",
        deliveryMode: "conversational",
        adaptive: true,
        questionCount: 3,
        questions: [{ text: "How would you make an API reliable?", required: true }],
    }],
    ...overrides,
});

describe("assessment wizard helpers", () => {
    it("validates only the fields needed for the current step", () => {
        expect(assessmentStepIssue(form({ jobRole: "" }), "role")).toMatch(/job role/i);
        expect(assessmentStepIssue(form({ rounds: [{ name: "Technical", questions: [] }] }), "plan")).toMatch(/question/i);
        expect(assessmentStepIssue(form({ durationMinutes: 300 }), "candidate")).toMatch(/duration/i);
        expect(assessmentStepIssue(form(), "role")).toBe("");
    });

    it("requires invitees only when publishing an invite-only assessment", () => {
        expect(publishReadinessIssue(form({ inviteOnly: true }))).toMatch(/candidate email/i);
        expect(publishReadinessIssue(form({ inviteOnly: true, inviteEmails: "one@example.com" }))).toBe("");
    });

    it("parses candidate email lists and normalizes round payloads", () => {
        expect(parseCandidateEmails("one@example.com, two@example.com\nthree@example.com")).toEqual([
            "one@example.com",
            "two@example.com",
            "three@example.com",
        ]);
        const [round] = normalizeAssessmentRounds(form().rounds);
        expect(round.questionCount).toBe(3);
        expect(round.questions[0]).toEqual({
            text: "How would you make an API reliable?",
            weight: 1,
            competencies: [],
            knockout: false,
            required: true,
        });
    });
});
