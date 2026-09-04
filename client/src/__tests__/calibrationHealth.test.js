import { describe, expect, it } from "vitest";
import { calibrationHealth } from "../utils/calibrationHealth";

describe("calibrationHealth", () => {
    it("does not raise quality alarms before the minimum sample", () => {
        expect(calibrationHealth({ reviewerAgreement: { reviewedPairs: 5, meanAbsoluteError: 4 }, adaptive: { completed: 5, fallbackQuestionRate: 90 } })).toEqual({ status: "collecting", signals: [] });
    });

    it("flags material reviewer disagreement and bias after enough reviews", () => {
        const health = calibrationHealth({ reviewerAgreement: { reviewedPairs: 25, meanAbsoluteError: 1.8, meanBias: 1.2, overTwoPoints: 28 }, adaptive: { completed: 0 } });
        expect(health.status).toBe("attention");
        expect(health.signals.map((item) => item.key)).toEqual(expect.arrayContaining(["reviewer-mae", "reviewer-bias", "reviewer-tail"]));
    });

    it("flags adaptive fallback and coverage regressions after enough completed rounds", () => {
        const health = calibrationHealth({ reviewerAgreement: { reviewedPairs: 0 }, adaptive: { completed: 30, fallbackQuestionRate: 12, averageCoverage: 68 } });
        expect(health.status).toBe("attention");
        expect(health.signals.map((item) => item.key)).toEqual(expect.arrayContaining(["fallback-rate", "coverage"]));
    });

    it("reports stable when sampled metrics remain within guardrails", () => {
        expect(calibrationHealth({ reviewerAgreement: { reviewedPairs: 30, meanAbsoluteError: 0.8, meanBias: -0.2, overTwoPoints: 6 }, adaptive: { completed: 30, fallbackQuestionRate: 3, averageCoverage: 88 } })).toEqual({ status: "stable", signals: [] });
    });
});
