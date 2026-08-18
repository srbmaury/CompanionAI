import { describe, expect, it } from "vitest";
import { assessQuestionSet } from "../utils/assessmentQuality";

describe("assessment quality diagnostics", () => {
    it("flags duplicates, missing competencies, and target mismatches", () => {
        const result = assessQuestionSet({
            jobDescription: "Design reliable distributed services with strong security and observability.",
            rounds: [{ questionCount: 3, questions: [
                { text: "How would you design reliable distributed services?", competencies: ["System design"] },
                { text: "How would you design reliable distributed services?", competencies: [] },
            ] }],
        });

        expect(result.total).toBe(2);
        expect(result.duplicates).toBe(1);
        expect(result.withoutCompetencies).toBe(1);
        expect(result.targetMismatch).toBe(1);
        expect(result.coverage).toBeGreaterThan(0);
    });
});
