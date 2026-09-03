export const PLAN_LIMITS = {
    free: {
        interviewsPerMonth: Number(process.env.FREE_INTERVIEWS_PER_MONTH || 3),
        resumeReviewsPerMonth: Number(process.env.FREE_RESUME_REVIEWS_PER_MONTH || 3),
    },
    pro: {
        interviewsPerMonth: Number(process.env.PRO_INTERVIEWS_PER_MONTH || 100),
        resumeReviewsPerMonth: Number(process.env.PRO_RESUME_REVIEWS_PER_MONTH || 100),
    },
    scale: {
        interviewsPerMonth: Number(process.env.SCALE_INTERVIEWS_PER_MONTH || 1000),
        resumeReviewsPerMonth: Number(process.env.SCALE_RESUME_REVIEWS_PER_MONTH || 1000),
    },
};

export const activePlan = (user) => ["pro", "scale"].includes(user?.plan) && ["active", "trialing"].includes(user?.subscriptionStatus) ? user.plan : "free";
export const limitsFor = (user) => ({ plan: activePlan(user), ...PLAN_LIMITS[activePlan(user)] });
export const currentMonth = (date = new Date()) => date.toISOString().slice(0, 7);
