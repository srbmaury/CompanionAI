import { currentMonth } from "./practiceEntitlements.js";

export const HIRING_PLAN_LIMITS = {
    none: {
        candidateInterviews: 0,
    },
    trial: {
        candidateInterviews: Number(process.env.HIRING_TRIAL_CANDIDATE_INTERVIEWS || 5),
    },
    starter: {
        candidateInterviews: Number(process.env.HIRING_STARTER_CANDIDATE_INTERVIEWS_PER_MONTH || 25),
    },
    growth: {
        candidateInterviews: Number(process.env.HIRING_GROWTH_CANDIDATE_INTERVIEWS_PER_MONTH || 100),
    },
    enterprise: {
        candidateInterviews: Number(process.env.HIRING_ENTERPRISE_CANDIDATE_INTERVIEWS_PER_MONTH || 100000),
    },
};

const PAID_PLANS = new Set(["starter", "growth", "enterprise"]);
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

export const activeHiringPlan = (organization) => {
    if (
        PAID_PLANS.has(organization?.hiringPlan)
        && ACTIVE_SUBSCRIPTION_STATUSES.has(organization?.hiringSubscriptionStatus)
    ) {
        return organization.hiringPlan;
    }
    return organization?.hiringTrialEligible ? "trial" : "none";
};

export const hiringLimitsFor = (organization) => {
    const plan = activeHiringPlan(organization);
    return { plan, ...HIRING_PLAN_LIMITS[plan] };
};

export const hiringUsagePeriod = (organization, date = new Date()) => {
    const plan = activeHiringPlan(organization);
    return ["starter", "growth", "enterprise"].includes(plan)
        ? { key: currentMonth(date), cadence: "month" }
        : { key: "lifetime", cadence: "lifetime" };
};
