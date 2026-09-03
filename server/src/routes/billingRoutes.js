import express from "express";
import { z } from "zod";
import protect from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";
import PracticeUsageCounter from "../models/PracticeUsageCounter.js";
import Organization from "../models/Organization.js";
import OrganizationUsageCounter from "../models/OrganizationUsageCounter.js";
import { currentMonth, practiceLimitsFor, PRACTICE_PLAN_LIMITS } from "../services/practiceEntitlements.js";
import { hiringLimitsFor, hiringUsagePeriod, HIRING_PLAN_LIMITS } from "../services/hiringEntitlements.js";
import { getStripe } from "../config/stripe.js";
import { getConfiguredPriceId, getPlanPrice } from "../services/billingCatalog.js";
import { organizationContext, requireOrganizationRole } from "../middleware/organizationContext.js";
import metrics from "../metrics/index.js";

const router = express.Router();
const clientOrigin = () => process.env.CLIENT_ORIGIN || "http://localhost:5173";
const billingConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);

const safePrice = async (product, plan) => {
    try {
        if (process.env.NODE_ENV === "test" || !process.env.STRIPE_SECRET_KEY) return null;
        return await getPlanPrice(product, plan);
    } catch (error) {
        console.warn(`Stripe ${product} ${plan} price lookup failed`, error?.message || error);
        return null;
    }
};

router.get("/practice/entitlements", protect, async (req, res, next) => {
    try {
        res.setHeader("Cache-Control", "no-store");
        const period = currentMonth();
        const limits = practiceLimitsFor(req.user);
        const counters = await PracticeUsageCounter.find({ user: req.user._id, period }).lean();
        const used = Object.fromEntries(counters.map((item) => [item.metric, item.used]));
        const proPrice = await safePrice("practice", "pro");
        return res.json({
            product: "practice",
            period,
            plan: limits.plan,
            subscriptionStatus: req.user.practiceSubscriptionStatus,
            limits: {
                interviews: limits.interviewsPerMonth,
                resumeReviews: limits.resumeReviewsPerMonth,
            },
            planLimits: {
                free: {
                    interviews: PRACTICE_PLAN_LIMITS.free.interviewsPerMonth,
                    resumeReviews: PRACTICE_PLAN_LIMITS.free.resumeReviewsPerMonth,
                },
                pro: {
                    interviews: PRACTICE_PLAN_LIMITS.pro.interviewsPerMonth,
                    resumeReviews: PRACTICE_PLAN_LIMITS.pro.resumeReviewsPerMonth,
                },
            },
            used: {
                interviews: used.interviews || 0,
                resumeReviews: used.resumeReviews || 0,
            },
            prices: { pro: proPrice },
            billingAvailable: { pro: Boolean(billingConfigured() && proPrice) },
        });
    } catch (error) {
        return next(error);
    }
});

router.post(
    "/practice/checkout-session",
    protect,
    validate(z.object({ plan: z.literal("pro").optional().default("pro") })),
    async (req, res, next) => {
        try {
            const selectedPlan = req.body.plan;
            const priceId = getConfiguredPriceId("practice", selectedPlan);
            if (!priceId) return res.status(503).json({ message: "Practice Pro checkout is not configured" });
            if (practiceLimitsFor(req.user).plan === "pro") return res.status(409).json({ message: "Practice Pro is already active" });
            if (req.user.practiceBillingCustomerId && req.user.practiceSubscriptionStatus !== "inactive") {
                return res.status(409).json({ message: "Use Manage billing to change your Practice subscription" });
            }
            const session = await getStripe().checkout.sessions.create({
                mode: "subscription",
                line_items: [{ price: priceId, quantity: 1 }],
                customer: req.user.practiceBillingCustomerId || undefined,
                customer_email: req.user.practiceBillingCustomerId ? undefined : req.user.email,
                client_reference_id: String(req.user._id),
                metadata: { billingProduct: "practice", userId: String(req.user._id), plan: selectedPlan },
                subscription_data: { metadata: { billingProduct: "practice", userId: String(req.user._id), plan: selectedPlan } },
                allow_promotion_codes: true,
                success_url: `${clientOrigin()}/billing/success?product=practice`,
                cancel_url: `${clientOrigin()}/pricing?checkout=cancelled`,
            });
            metrics.billingCheckoutTotal.labels("success").inc();
            return res.json({ url: session.url });
        } catch (error) {
            metrics.billingCheckoutTotal.labels("failure").inc();
            return next(error);
        }
    },
);

router.post("/practice/portal-session", protect, async (req, res, next) => {
    try {
        if (!req.user.practiceBillingCustomerId) return res.status(400).json({ message: "No Practice billing account found" });
        const session = await getStripe().billingPortal.sessions.create({
            customer: req.user.practiceBillingCustomerId,
            return_url: `${clientOrigin()}/pricing`,
        });
        return res.json({ url: session.url });
    } catch (error) {
        return next(error);
    }
});

router.get("/hiring/entitlements", protect, organizationContext, async (req, res, next) => {
    try {
        res.setHeader("Cache-Control", "no-store");
        const limits = hiringLimitsFor(req.organization);
        const period = hiringUsagePeriod(req.organization);
        const counter = await OrganizationUsageCounter.findOne({
            organization: req.organizationId,
            metric: "candidateInterviews",
            period: period.key,
        }).lean();
        const [starterPrice, growthPrice] = await Promise.all([
            safePrice("hiring", "starter"),
            safePrice("hiring", "growth"),
        ]);
        const used = counter?.used || 0;
        return res.json({
            product: "hiring",
            organization: { _id: req.organization._id, name: req.organization.name },
            plan: limits.plan,
            subscriptionStatus: req.organization.hiringSubscriptionStatus,
            period: period.key,
            periodType: period.cadence,
            limits: { candidateInterviews: limits.candidateInterviews },
            used: { candidateInterviews: used },
            remaining: Math.max(limits.candidateInterviews - used, 0),
            planLimits: Object.fromEntries(
                Object.entries(HIRING_PLAN_LIMITS)
                    .filter(([plan]) => plan !== "none")
                    .map(([plan, value]) => [plan, { candidateInterviews: value.candidateInterviews }]),
            ),
            prices: { starter: starterPrice, growth: growthPrice },
            billingAvailable: {
                starter: Boolean(billingConfigured() && starterPrice),
                growth: Boolean(billingConfigured() && growthPrice),
            },
            canManageBilling: ["owner", "admin"].includes(req.organizationRole),
        });
    } catch (error) {
        return next(error);
    }
});

router.post(
    "/hiring/checkout-session",
    protect,
    organizationContext,
    requireOrganizationRole("owner", "admin"),
    validate(z.object({ plan: z.enum(["starter", "growth"]) })),
    async (req, res, next) => {
        try {
            const selectedPlan = req.body.plan;
            const priceId = getConfiguredPriceId("hiring", selectedPlan);
            if (!priceId) return res.status(503).json({ message: `${selectedPlan === "growth" ? "Growth" : "Starter"} checkout is not configured` });
            if (hiringLimitsFor(req.organization).plan === selectedPlan) {
                return res.status(409).json({ message: `Hiring ${selectedPlan} is already active for this organization` });
            }
            const organization = await Organization.findById(req.organizationId)
                .select("+hiringBillingCustomerId +hiringBillingSubscriptionId");
            if (!organization) return res.status(404).json({ message: "Organization not found" });
            if (organization.hiringBillingCustomerId && ["active", "trialing"].includes(organization.hiringSubscriptionStatus)) {
                return res.status(409).json({ message: "Use Manage billing to change this organization's active Hiring subscription" });
            }
            const session = await getStripe().checkout.sessions.create({
                mode: "subscription",
                line_items: [{ price: priceId, quantity: 1 }],
                customer: organization.hiringBillingCustomerId || undefined,
                customer_email: organization.hiringBillingCustomerId ? undefined : req.user.email,
                client_reference_id: String(organization._id),
                metadata: {
                    billingProduct: "hiring",
                    organizationId: String(organization._id),
                    purchasedByUserId: String(req.user._id),
                    plan: selectedPlan,
                },
                subscription_data: {
                    metadata: {
                        billingProduct: "hiring",
                        organizationId: String(organization._id),
                        purchasedByUserId: String(req.user._id),
                        plan: selectedPlan,
                    },
                },
                allow_promotion_codes: true,
                success_url: `${clientOrigin()}/billing/success?product=hiring&organizationId=${organization._id}`,
                cancel_url: `${clientOrigin()}/hiring/team?billing=cancelled`,
            });
            metrics.billingCheckoutTotal.labels("success").inc();
            return res.json({ url: session.url });
        } catch (error) {
            metrics.billingCheckoutTotal.labels("failure").inc();
            return next(error);
        }
    },
);

router.post(
    "/hiring/portal-session",
    protect,
    organizationContext,
    requireOrganizationRole("owner", "admin"),
    async (req, res, next) => {
        try {
            const organization = await Organization.findById(req.organizationId).select("+hiringBillingCustomerId");
            if (!organization?.hiringBillingCustomerId) return res.status(400).json({ message: "No Hiring billing account found for this organization" });
            const session = await getStripe().billingPortal.sessions.create({
                customer: organization.hiringBillingCustomerId,
                return_url: `${clientOrigin()}/hiring/team`,
            });
            return res.json({ url: session.url });
        } catch (error) {
            return next(error);
        }
    },
);

export default router;
