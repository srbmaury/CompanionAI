export const HIRING_PLAN_LIMITS = {
    trial: { candidateInterviews: Number(process.env.HIRING_TRIAL_CANDIDATE_INTERVIEWS || 5) },
    starter: { candidateInterviewsPerMonth: Number(process.env.HIRING_STARTER_CANDIDATE_INTERVIEWS || 25) },
    growth: { candidateInterviewsPerMonth: Number(process.env.HIRING_GROWTH_CANDIDATE_INTERVIEWS || 100) },
    enterprise: { candidateInterviewsPerMonth: Number(process.env.HIRING_ENTERPRISE_CANDIDATE_INTERVIEWS || 1000000) },
};

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export const activeHiringPlan = (organization) => {
    const plan = organization?.billing?.plan || "trial";
    if (plan === "trial") return "trial";
    return ACTIVE_STATUSES.has(organization?.billing?.subscriptionStatus) ? plan : "trial";
};

export const hiringLimitsFor = (organization) => {
    const plan = activeHiringPlan(organization);
    return { plan, ...HIRING_PLAN_LIMITS[plan] };
};

export const currentMonth = (date = new Date()) => date.toISOString().slice(0, 7);
