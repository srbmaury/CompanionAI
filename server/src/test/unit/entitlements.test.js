import { describe, expect, it } from "vitest";
import { activePlan, limitsFor, PLAN_LIMITS } from "../../services/entitlements.js";

describe("plan entitlements", () => {
    it("grants Scale limits only while its subscription is active", () => {
        expect(activePlan({ plan: "scale", subscriptionStatus: "active" })).toBe("scale");
        expect(limitsFor({ plan: "scale", subscriptionStatus: "trialing" })).toMatchObject({ plan: "scale", ...PLAN_LIMITS.scale });
        expect(activePlan({ plan: "scale", subscriptionStatus: "past_due" })).toBe("free");
    });
});
