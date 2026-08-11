export const PLAN_LIMITS = {
    free: { interviewsPerMonth: Number(process.env.FREE_INTERVIEWS_PER_MONTH || 3), resumeReviewsPerMonth: Number(process.env.FREE_RESUME_REVIEWS_PER_MONTH || 3), assessmentsPerMonth: Number(process.env.FREE_ASSESSMENTS_PER_MONTH || 2) },
    pro: { interviewsPerMonth: Number(process.env.PRO_INTERVIEWS_PER_MONTH || 100), resumeReviewsPerMonth: Number(process.env.PRO_RESUME_REVIEWS_PER_MONTH || 100), assessmentsPerMonth: Number(process.env.PRO_ASSESSMENTS_PER_MONTH || 50) },
    scale: { interviewsPerMonth: Number(process.env.SCALE_INTERVIEWS_PER_MONTH || 1000), resumeReviewsPerMonth: Number(process.env.SCALE_RESUME_REVIEWS_PER_MONTH || 1000), assessmentsPerMonth: Number(process.env.SCALE_ASSESSMENTS_PER_MONTH || 500) },
};

export const activePlan = (user) => ["pro", "scale"].includes(user?.plan) && ["active", "trialing"].includes(user?.subscriptionStatus) ? user.plan : "free";
export const limitsFor = (user) => ({ plan: activePlan(user), ...PLAN_LIMITS[activePlan(user)] });
export const currentMonth = (date = new Date()) => date.toISOString().slice(0, 7);
