import { describe, expect, it } from "vitest";
import { getDefaultQuestionLimit } from "../utils/roundDefaults";

describe("getDefaultQuestionLimit", () => {
    it("keeps deep interview rounds focused", () => {
        expect(getDefaultQuestionLimit({ roundName: "Coding Interview" })).toBe(3);
        expect(getDefaultQuestionLimit({ roundName: "System Design Interview" })).toBe(3);
    });

    it("allows more short questions in screens and assessments", () => {
        expect(getDefaultQuestionLimit({ roundName: "Recruiter Screening" })).toBe(5);
        expect(getDefaultQuestionLimit({ roundName: "Technical Test", deliveryMode: "online-assessment" })).toBe(6);
    });

    it("uses a moderate fallback", () => {
        expect(getDefaultQuestionLimit({ roundName: "Domain Discussion" })).toBe(4);
    });
});
