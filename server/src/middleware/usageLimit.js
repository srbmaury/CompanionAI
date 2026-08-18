import UsageCounter from "../models/UsageCounter.js";
import { currentMonth, limitsFor } from "../services/entitlements.js";

const metricLabels = { interviews: "practice interviews", resumeReviews: "resume reviews", assessments: "candidate assessments" };

export default function usageLimit(metric, limitKey) {
    return async (req, res, next) => {
        try {
            const limit = limitsFor(req.user)[limitKey];
            const period = currentMonth();
            const filter = { user: req.user._id, metric, period, used: { $lt: limit } };
            let counter = await UsageCounter.findOneAndUpdate(filter, { $inc: { used: 1 } }, { new: true });
            if (!counter) {
                try { counter = await UsageCounter.create({ user: req.user._id, metric, period, used: 1 }); }
                catch { counter = await UsageCounter.findOneAndUpdate(filter, { $inc: { used: 1 } }, { new: true }); }
            }
            if (!counter) {
                const plan = `${req.user.plan || "free"}`;
                const planLabel = `${plan.charAt(0).toUpperCase()}${plan.slice(1)}`;
                const label = metricLabels[metric] || metric;
                return res.status(429).json({ message: `You’ve used all ${limit} ${label} included in your ${planLabel} plan this month. Your allowance resets next month, or you can upgrade in Plans & billing.`, code: "PLAN_LIMIT_REACHED", metric, limit, period });
            }
            let released = false;
            const release = async () => { if (released) return; released = true; await UsageCounter.updateOne({ _id: counter._id, used: { $gt: 0 } }, { $inc: { used: -1 } }).catch(() => {}); };
            res.on("finish", () => { if (res.statusCode >= 400) release(); });
            req.usageReservation = { metric, period, limit, used: counter.used };
            return next();
        } catch (error) { return next(error); }
    };
}
