import express from "express";
import protect from "../middleware/authMiddleware.js";
import UsageCounter from "../models/UsageCounter.js";
import { currentMonth, limitsFor } from "../services/entitlements.js";
import { getStripe } from "../config/stripe.js";
import { getProPrice } from "../services/billingCatalog.js";
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
        let proPrice = null;
        try { if (process.env.NODE_ENV !== "test" && process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRO_PRICE_ID) proPrice = await getProPrice(); } catch (error) { console.warn("Stripe price lookup failed", error?.message || error); }
        res.json({ period, plan: limits.plan, subscriptionStatus: req.user.subscriptionStatus, limits: { interviews: limits.interviewsPerMonth, resumeReviews: limits.resumeReviewsPerMonth }, used: { interviews: used.interviews || 0, resumeReviews: used.resumeReviews || 0 }, proPrice, billingAvailable: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && proPrice) });
    } catch (error) { next(error); }
});
router.post("/checkout-session", protect, async (req, res, next) => {
    try {
        if (!process.env.STRIPE_PRO_PRICE_ID) return res.status(503).json({ message: "Pro checkout is not configured" });
        if (limitsFor(req.user).plan === "pro") return res.status(409).json({ message: "You already have an active Pro subscription" });
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
            customer: req.user.billingCustomerId || undefined,
            customer_email: req.user.billingCustomerId ? undefined : req.user.email,
            client_reference_id: String(req.user._id),
            metadata: { userId: String(req.user._id) },
            subscription_data: { metadata: { userId: String(req.user._id) } },
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
