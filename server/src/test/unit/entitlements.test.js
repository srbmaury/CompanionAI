import { describe, expect, it } from "vitest";
import { activePracticePlan, practiceLimitsFor, PRACTICE_PLAN_LIMITS } from "../../services/practiceEntitlements.js";

describe("plan entitlements", () => {
    it("grants Scale limits only while its subscription is active", () => {
        expect(activePracticePlan({ plan: "scale", practiceSubscriptionStatus: "active" })).toBe("scale");
        expect(practiceLimitsFor({ plan: "scale", practiceSubscriptionStatus: "trialing" })).toMatchObject({ plan: "scale", ...PRACTICE_PLAN_LIMITS.scale });
        expect(activePracticePlan({ plan: "scale", practiceSubscriptionStatus: "past_due" })).toBe("free");
    });
});
