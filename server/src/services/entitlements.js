export const PLAN_LIMITS = {
    free: { interviewsPerMonth: Number(process.env.FREE_INTERVIEWS_PER_MONTH || 3), resumeReviewsPerMonth: Number(process.env.FREE_RESUME_REVIEWS_PER_MONTH || 3), assessmentsPerMonth: Number(process.env.FREE_ASSESSMENTS_PER_MONTH || 2) },
    pro: { interviewsPerMonth: Number(process.env.PRO_INTERVIEWS_PER_MONTH || 100), resumeReviewsPerMonth: Number(process.env.PRO_RESUME_REVIEWS_PER_MONTH || 100), assessmentsPerMonth: Number(process.env.PRO_ASSESSMENTS_PER_MONTH || 50) },
};

export const activePlan = (user) => user?.plan === "pro" && ["active", "trialing"].includes(user?.subscriptionStatus) ? "pro" : "free";
export const limitsFor = (user) => ({ plan: activePlan(user), ...PLAN_LIMITS[activePlan(user)] });
export const currentMonth = (date = new Date()) => date.toISOString().slice(0, 7);
