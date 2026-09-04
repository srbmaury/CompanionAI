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

    it("gives an active design-partner grant its own quota bucket", () => {
        const now = new Date("2026-09-04T12:00:00Z");
        const organization = {
            hiringPlan: "none",
            hiringSubscriptionStatus: "inactive",
            hiringTrialEligible: false,
            hiringGrant: {
                type: "design_partner",
                candidateInterviews: 10,
                grantId: "admin:org:1",
                startsAt: new Date("2026-09-01T00:00:00Z"),
                expiresAt: new Date("2026-10-01T00:00:00Z"),
            },
        };
        expect(activeHiringPlan(organization, now)).toBe("design_partner");
        expect(hiringLimitsFor(organization, now)).toMatchObject({
            plan: "design_partner",
            accessType: "grant",
            candidateInterviews: 10,
            grantId: "admin:org:1",
        });
        expect(hiringUsagePeriod(organization, now)).toEqual({ key: "grant:admin:org:1", cadence: "grant" });
    });

    it("expires a grant without reusing its quota bucket", () => {
        const organization = {
            hiringPlan: "none",
            hiringSubscriptionStatus: "inactive",
            hiringTrialEligible: false,
            hiringGrant: {
                type: "paid_pilot",
                candidateInterviews: 15,
                grantId: "pilot:cs_test",
                startsAt: new Date("2026-08-01T00:00:00Z"),
                expiresAt: new Date("2026-08-31T00:00:00Z"),
            },
        };
        const now = new Date("2026-09-04T12:00:00Z");
        expect(activeHiringPlan(organization, now)).toBe("none");
        expect(hiringLimitsFor(organization, now)).toMatchObject({ plan: "none", candidateInterviews: 0 });
        expect(hiringUsagePeriod(organization, now)).toEqual({ key: "lifetime", cadence: "lifetime" });
    });

    it("gives an active paid subscription precedence over a grant", () => {
        const organization = {
            hiringPlan: "starter",
            hiringSubscriptionStatus: "active",
            hiringTrialEligible: false,
            hiringGrant: {
                type: "design_partner",
                candidateInterviews: 10,
                grantId: "admin:org:2",
                startsAt: new Date("2026-09-01T00:00:00Z"),
                expiresAt: new Date("2026-10-01T00:00:00Z"),
            },
        };
        expect(activeHiringPlan(organization)).toBe("starter");
        expect(hiringLimitsFor(organization)).toMatchObject({
            plan: "starter",
            accessType: "subscription",
            ...HIRING_PLAN_LIMITS.starter,
        });
        expect(hiringUsagePeriod(organization).cadence).toBe("month");
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
