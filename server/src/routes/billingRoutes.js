import express from "express";
import { z } from "zod";
import protect from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";
import UsageCounter from "../models/UsageCounter.js";
import { currentMonth, limitsFor, PLAN_LIMITS } from "../services/entitlements.js";
import { getStripe } from "../config/stripe.js";
import { getPlanPrice } from "../services/billingCatalog.js";
import metrics from "../metrics/index.js";

const router = express.Router();
const clientOrigin = () => process.env.CLIENT_ORIGIN || "http://localhost:5173";
router.get("/entitlements", protect, async (req, res, next) => {
    try {
        res.setHeader("Cache-Control", "no-store");
        const period = currentMonth();
        const limits = limitsFor(req.user);
        const counters = await UsageCounter.find({ user: req.user._id, period }).lean();
        const used = Object.fromEntries(counters.map((item) => [item.metric, item.used]));
        let proPrice = null; let scalePrice = null;
        try { if (process.env.NODE_ENV !== "test" && process.env.STRIPE_SECRET_KEY) [proPrice, scalePrice] = await Promise.all([getPlanPrice("pro"), getPlanPrice("scale")]); } catch (error) { console.warn("Stripe price lookup failed", error?.message || error); }
        const billingConfigured = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
        res.json({ period, plan: limits.plan, subscriptionStatus: req.user.subscriptionStatus, limits: { interviews: limits.interviewsPerMonth, resumeReviews: limits.resumeReviewsPerMonth, assessments: limits.assessmentsPerMonth }, planLimits: { free: { interviews: PLAN_LIMITS.free.interviewsPerMonth, resumeReviews: PLAN_LIMITS.free.resumeReviewsPerMonth, assessments: PLAN_LIMITS.free.assessmentsPerMonth }, pro: { interviews: PLAN_LIMITS.pro.interviewsPerMonth, resumeReviews: PLAN_LIMITS.pro.resumeReviewsPerMonth, assessments: PLAN_LIMITS.pro.assessmentsPerMonth }, scale: { interviews: PLAN_LIMITS.scale.interviewsPerMonth, resumeReviews: PLAN_LIMITS.scale.resumeReviewsPerMonth, assessments: PLAN_LIMITS.scale.assessmentsPerMonth } }, used: { interviews: used.interviews || 0, resumeReviews: used.resumeReviews || 0, assessments: used.assessments || 0 }, prices: { pro: proPrice, scale: scalePrice }, proPrice, billingAvailable: { pro: Boolean(billingConfigured && proPrice), scale: Boolean(billingConfigured && scalePrice) } });
    } catch (error) { next(error); }
});
router.post("/checkout-session", protect, validate(z.object({ plan: z.enum(["pro", "scale"]).optional().default("pro") })), async (req, res, next) => {
    try {
        const selectedPlan = req.body.plan;
        const priceId = selectedPlan === "scale" ? process.env.STRIPE_SCALE_PRICE_ID : process.env.STRIPE_PRO_PRICE_ID;
        if (!priceId) return res.status(503).json({ message: `${selectedPlan === "scale" ? "Scale" : "Pro"} checkout is not configured` });
        if (limitsFor(req.user).plan === selectedPlan) return res.status(409).json({ message: `You already have an active ${selectedPlan === "scale" ? "Scale" : "Pro"} subscription` });
        if (req.user.billingCustomerId && limitsFor(req.user).plan !== "free") return res.status(409).json({ message: "Use Manage billing to change your active subscription" });
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            line_items: [{ price: priceId, quantity: 1 }],
            customer: req.user.billingCustomerId || undefined,
            customer_email: req.user.billingCustomerId ? undefined : req.user.email,
            client_reference_id: String(req.user._id),
            metadata: { userId: String(req.user._id), plan: selectedPlan },
            subscription_data: { metadata: { userId: String(req.user._id), plan: selectedPlan } },
            allow_promotion_codes: true,
            success_url: `${clientOrigin()}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${clientOrigin()}/pricing?checkout=cancelled`,
        });
        metrics.billingCheckoutTotal.labels("success").inc();
        return res.json({ url: session.url });
    } catch (error) { metrics.billingCheckoutTotal.labels("failure").inc(); return next(error); }
});
router.post("/portal-session", protect, async (req, res, next) => {
    try {
        if (!req.user.billingCustomerId) return res.status(400).json({ message: "No billing account found" });
        const session = await getStripe().billingPortal.sessions.create({ customer: req.user.billingCustomerId, return_url: `${clientOrigin()}/profile` });
        return res.json({ url: session.url });
    } catch (error) { return next(error); }
});
export default router;
