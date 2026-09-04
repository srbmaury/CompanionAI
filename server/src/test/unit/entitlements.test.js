import { describe, expect, it } from "vitest";
import { activePracticePlan, practiceLimitsFor, PRACTICE_PLAN_LIMITS } from "../../services/practiceEntitlements.js";
import { activeHiringPlan, hiringLimitsFor, hiringUsagePeriod, HIRING_PLAN_LIMITS } from "../../services/hiringEntitlements.js";

describe("product entitlements", () => {
    it("grants Practice Pro only while the personal subscription is active", () => {
        expect(activePracticePlan({ practicePlan: "pro", practiceSubscriptionStatus: "active" })).toBe("pro");
        expect(practiceLimitsFor({ practicePlan: "pro", practiceSubscriptionStatus: "trialing" })).toMatchObject({
            plan: "pro",
            ...PRACTICE_PLAN_LIMITS.pro,
        });
        expect(activePracticePlan({ practicePlan: "pro", practiceSubscriptionStatus: "past_due" })).toBe("free");
        expect(activePracticePlan({ practicePlan: "free", practiceSubscriptionStatus: "active" })).toBe("free");
    });

    it("uses lifetime trial credits only for an eligible unpaid organization", () => {
        const organization = {
            hiringPlan: "trial",
            hiringSubscriptionStatus: "inactive",
            hiringTrialEligible: true,
        };
        expect(activeHiringPlan(organization)).toBe("trial");
        expect(hiringLimitsFor(organization)).toMatchObject({
            plan: "trial",
            ...HIRING_PLAN_LIMITS.trial,
        });
        expect(hiringUsagePeriod(organization)).toEqual({ key: "lifetime", cadence: "lifetime" });
    });

    it("grants paid Hiring capacity to the organization, not to a user", () => {
        const organization = {
            hiringPlan: "growth",
            hiringSubscriptionStatus: "active",
            hiringTrialEligible: false,
        };
        expect(activeHiringPlan(organization)).toBe("growth");
        expect(hiringLimitsFor(organization)).toMatchObject({
            plan: "growth",
            ...HIRING_PLAN_LIMITS.growth,
        });
        expect(hiringUsagePeriod(organization).cadence).toBe("month");
    });

    it("does not restore trial capacity after a paid Hiring subscription becomes inactive", () => {
        const organization = {
            hiringPlan: "growth",
            hiringSubscriptionStatus: "canceled",
            hiringTrialEligible: false,
        };
        expect(activeHiringPlan(organization)).toBe("none");
        expect(hiringLimitsFor(organization)).toMatchObject({
            plan: "none",
            ...HIRING_PLAN_LIMITS.none,
        });
        expect(hiringUsagePeriod(organization)).toEqual({ key: "lifetime", cadence: "lifetime" });
    });
});
