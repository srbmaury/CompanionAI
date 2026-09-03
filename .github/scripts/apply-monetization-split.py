from pathlib import Path
import re

ROOT = Path('.')


def read(path):
    return (ROOT / path).read_text()


def write(path, content):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content.rstrip() + "\n")


def replace(path, old, new, *, required=True, count=None):
    target = ROOT / path
    text = target.read_text()
    if required and old not in text:
        raise RuntimeError(f"Expected text not found in {path}: {old[:120]!r}")
    if count is None:
        updated = text.replace(old, new)
    else:
        updated = text.replace(old, new, count)
    target.write_text(updated)


def regex_replace(path, pattern, replacement, *, required=True, flags=0):
    target = ROOT / path
    text = target.read_text()
    updated, count = re.subn(pattern, replacement, text, flags=flags)
    if required and count == 0:
        raise RuntimeError(f"Pattern not found in {path}: {pattern}")
    target.write_text(updated)
    return count


# ---------------------------------------------------------------------------
# 1) Practice billing is explicitly user-owned.
# ---------------------------------------------------------------------------
replace(
    'server/src/models/User.js',
    '        plan: { type: String, enum: ["free", "pro", "scale"], default: "free", index: true },\n'
    '        subscriptionStatus: { type: String, enum: ["inactive", "incomplete", "incomplete_expired", "trialing", "active", "past_due", "canceled", "unpaid", "paused"], default: "inactive" },\n'
    '        billingProvider: { type: String, enum: ["none", "stripe"], default: "none", select: false },\n'
    '        billingCustomerId: { type: String, default: "", select: false },\n'
    '        billingSubscriptionId: { type: String, default: "", select: false },',
    '        practicePlan: { type: String, enum: ["free", "pro"], default: "free", index: true },\n'
    '        practiceSubscriptionStatus: { type: String, enum: ["inactive", "incomplete", "incomplete_expired", "trialing", "active", "past_due", "canceled", "unpaid", "paused"], default: "inactive" },\n'
    '        practiceBillingProvider: { type: String, enum: ["none", "stripe"], default: "none", select: false },\n'
    '        practiceBillingCustomerId: { type: String, default: "", select: false },\n'
    '        practiceBillingSubscriptionId: { type: String, default: "", select: false },\n'
    '        practiceCurrentPeriodEnd: { type: Date, default: null },'
)

# Existing product code that referenced the old user billing fields now refers
# explicitly to Practice. Billing-specific files are replaced below.
for path in (ROOT / 'server/src').rglob('*.js'):
    text = path.read_text()
    text = text.replace('billingCustomerId', 'practiceBillingCustomerId')
    text = text.replace('billingSubscriptionId', 'practiceBillingSubscriptionId')
    text = text.replace('billingProvider', 'practiceBillingProvider')
    text = text.replace('subscriptionStatus', 'practiceSubscriptionStatus')
    text = text.replace('req.user.plan', 'req.user.practicePlan')
    path.write_text(text)

replace(
    'server/src/controllers/authController.js',
    'const safeUserFields = "_id name email role provider preferredProgrammingLanguage practiceGoal targetRole weeklyPracticeTarget reminderEnabled reminderDay reminderTime reminderTimezone plan practiceSubscriptionStatus isVerified";',
    'const safeUserFields = "_id name email role provider preferredProgrammingLanguage practiceGoal targetRole weeklyPracticeTarget reminderEnabled reminderDay reminderTime reminderTimezone practicePlan practiceSubscriptionStatus isVerified";'
)
replace(
    'server/src/middleware/authMiddleware.js',
    'preferredProgrammingLanguage practiceGoal targetRole weeklyPracticeTarget reminderEnabled reminderDay reminderTime reminderTimezone plan practiceSubscriptionStatus tokenVersion isVerified +practiceBillingCustomerId',
    'preferredProgrammingLanguage practiceGoal targetRole weeklyPracticeTarget reminderEnabled reminderDay reminderTime reminderTimezone practicePlan practiceSubscriptionStatus tokenVersion isVerified +practiceBillingCustomerId'
)

# ---------------------------------------------------------------------------
# 2) Hiring billing is explicitly organization-owned.
# ---------------------------------------------------------------------------
write('server/src/models/Organization.js', '''import mongoose from "mongoose";

const subscriptionStatuses = [
    "inactive",
    "incomplete",
    "incomplete_expired",
    "trialing",
    "active",
    "past_due",
    "canceled",
    "unpaid",
    "paused",
];

const organizationSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 120,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        hiringPlan: {
            type: String,
            enum: ["trial", "starter", "growth", "enterprise"],
            default: "trial",
            index: true,
        },
        hiringSubscriptionStatus: {
            type: String,
            enum: subscriptionStatuses,
            default: "inactive",
        },
        hiringTrialEligible: {
            type: Boolean,
            default: true,
        },
        hiringBillingProvider: {
            type: String,
            enum: ["none", "stripe"],
            default: "none",
            select: false,
        },
        hiringBillingCustomerId: {
            type: String,
            default: "",
            select: false,
        },
        hiringBillingSubscriptionId: {
            type: String,
            default: "",
            select: false,
        },
        hiringCurrentPeriodEnd: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

organizationSchema.index({ createdBy: 1, createdAt: -1 });
organizationSchema.index({ hiringBillingCustomerId: 1 }, { sparse: true });

export default mongoose.model("Organization", organizationSchema);
''')

# Explicit counters make ownership obvious in code and indexes.
write('server/src/models/PracticeUsageCounter.js', '''import mongoose from "mongoose";

const practiceUsageCounterSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    metric: { type: String, enum: ["interviews", "resumeReviews"], required: true },
    period: { type: String, required: true },
    used: { type: Number, min: 0, default: 0 },
}, { timestamps: true });

practiceUsageCounterSchema.index({ user: 1, metric: 1, period: 1 }, { unique: true });

export default mongoose.model("PracticeUsageCounter", practiceUsageCounterSchema);
''')
write('server/src/models/OrganizationUsageCounter.js', '''import mongoose from "mongoose";

const organizationUsageCounterSchema = new mongoose.Schema({
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    metric: { type: String, enum: ["candidateInterviews"], required: true },
    period: { type: String, required: true },
    used: { type: Number, min: 0, default: 0 },
}, { timestamps: true });

organizationUsageCounterSchema.index({ organization: 1, metric: 1, period: 1 }, { unique: true });

export default mongoose.model("OrganizationUsageCounter", organizationUsageCounterSchema);
''')

# Rewrite imports/usages of the former generic user counter before deleting it.
for path in (ROOT / 'server/src').rglob('*.js'):
    if path.name in {'PracticeUsageCounter.js', 'OrganizationUsageCounter.js'}:
        continue
    text = path.read_text()
    if 'models/UsageCounter.js' in text:
        text = text.replace('../models/UsageCounter.js', '../models/PracticeUsageCounter.js')
        text = text.replace('../../models/UsageCounter.js', '../../models/PracticeUsageCounter.js')
        text = re.sub(r'\bUsageCounter\b', 'PracticeUsageCounter', text)
        path.write_text(text)
old_usage_model = ROOT / 'server/src/models/UsageCounter.js'
if old_usage_model.exists():
    old_usage_model.unlink()

# ---------------------------------------------------------------------------
# 3) Separate entitlement catalogs and middleware.
# ---------------------------------------------------------------------------
write('server/src/services/practiceEntitlements.js', '''export const PRACTICE_PLAN_LIMITS = {
    free: {
        interviewsPerMonth: Number(process.env.FREE_INTERVIEWS_PER_MONTH || 3),
        resumeReviewsPerMonth: Number(process.env.FREE_RESUME_REVIEWS_PER_MONTH || 3),
    },
    pro: {
        interviewsPerMonth: Number(process.env.PRO_INTERVIEWS_PER_MONTH || 100),
        resumeReviewsPerMonth: Number(process.env.PRO_RESUME_REVIEWS_PER_MONTH || 100),
    },
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

export const activePracticePlan = (user) => (
    user?.practicePlan === "pro" && ACTIVE_SUBSCRIPTION_STATUSES.has(user?.practiceSubscriptionStatus)
        ? "pro"
        : "free"
);

export const practiceLimitsFor = (user) => {
    const plan = activePracticePlan(user);
    return { plan, ...PRACTICE_PLAN_LIMITS[plan] };
};

export const currentMonth = (date = new Date()) => date.toISOString().slice(0, 7);
''')
write('server/src/services/hiringEntitlements.js', '''import { currentMonth } from "./practiceEntitlements.js";

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
''')

for path in (ROOT / 'server/src').rglob('*.js'):
    if path.name in {'practiceEntitlements.js', 'hiringEntitlements.js'}:
        continue
    text = path.read_text()
    if 'services/entitlements.js' in text:
        text = text.replace('../services/entitlements.js', '../services/practiceEntitlements.js')
        text = text.replace('../../services/entitlements.js', '../../services/practiceEntitlements.js')
        text = re.sub(r'\bPLAN_LIMITS\b', 'PRACTICE_PLAN_LIMITS', text)
        text = re.sub(r'\blimitsFor\b', 'practiceLimitsFor', text)
        text = re.sub(r'\bactivePlan\b', 'activePracticePlan', text)
        path.write_text(text)
old_entitlements = ROOT / 'server/src/services/entitlements.js'
if old_entitlements.exists():
    old_entitlements.unlink()

write('server/src/middleware/practiceUsageLimit.js', '''import PracticeUsageCounter from "../models/PracticeUsageCounter.js";
import { currentMonth, practiceLimitsFor } from "../services/practiceEntitlements.js";

const metricLabels = {
    interviews: "practice interviews",
    resumeReviews: "resume reviews",
};

export default function practiceUsageLimit(metric, limitKey) {
    return async (req, res, next) => {
        try {
            const limits = practiceLimitsFor(req.user);
            const limit = limits[limitKey];
            const period = currentMonth();
            const filter = { user: req.user._id, metric, period, used: { $lt: limit } };
            let counter = await PracticeUsageCounter.findOneAndUpdate(
                filter,
                { $inc: { used: 1 } },
                { new: true },
            );
            if (!counter) {
                try {
                    counter = await PracticeUsageCounter.create({ user: req.user._id, metric, period, used: 1 });
                } catch {
                    counter = await PracticeUsageCounter.findOneAndUpdate(
                        filter,
                        { $inc: { used: 1 } },
                        { new: true },
                    );
                }
            }
            if (!counter) {
                const label = metricLabels[metric] || metric;
                const planLabel = limits.plan === "pro" ? "Practice Pro" : "Practice Free";
                return res.status(429).json({
                    message: `You’ve used all ${limit} ${label} included in your ${planLabel} plan this month. Your allowance resets next month, or you can upgrade in Practice plans.`,
                    code: "PRACTICE_LIMIT_REACHED",
                    metric,
                    limit,
                    period,
                });
            }
            let released = false;
            const release = async () => {
                if (released) return;
                released = true;
                await PracticeUsageCounter.updateOne(
                    { _id: counter._id, used: { $gt: 0 } },
                    { $inc: { used: -1 } },
                ).catch(() => {});
            };
            res.on("finish", () => { if (res.statusCode >= 400) release(); });
            req.usageReservation = { product: "practice", metric, period, limit, used: counter.used };
            return next();
        } catch (error) {
            return next(error);
        }
    };
}
''')
for path in (ROOT / 'server/src').rglob('*.js'):
    if path.name == 'practiceUsageLimit.js':
        continue
    text = path.read_text()
    if 'middleware/usageLimit.js' in text:
        text = text.replace('../middleware/usageLimit.js', '../middleware/practiceUsageLimit.js')
        text = text.replace('../../middleware/usageLimit.js', '../../middleware/practiceUsageLimit.js')
        text = re.sub(r'\busageLimit\b', 'practiceUsageLimit', text)
        path.write_text(text)
old_usage_middleware = ROOT / 'server/src/middleware/usageLimit.js'
if old_usage_middleware.exists():
    old_usage_middleware.unlink()

# Assessment definitions are not the billing unit.
replace('server/src/routes/assessmentRoutes.js', 'import practiceUsageLimit from "../middleware/practiceUsageLimit.js";\n', '', required=False)
replace('server/src/routes/assessmentRoutes.js', 'practiceUsageLimit("assessments", "assessmentsPerMonth"), ', '', required=False)

# Shared organization usage reservation, used by public candidate starts.
write('server/src/services/organizationUsage.js', '''import Organization from "../models/Organization.js";
import OrganizationUsageCounter from "../models/OrganizationUsageCounter.js";
import { hiringLimitsFor, hiringUsagePeriod } from "./hiringEntitlements.js";

const METRIC = "candidateInterviews";

export const organizationHiringUsage = async (organizationOrId) => {
    const organization = typeof organizationOrId === "object" && organizationOrId?._id
        ? organizationOrId
        : await Organization.findById(organizationOrId);
    if (!organization) return null;
    const limits = hiringLimitsFor(organization);
    const period = hiringUsagePeriod(organization);
    const counter = await OrganizationUsageCounter.findOne({
        organization: organization._id,
        metric: METRIC,
        period: period.key,
    }).lean();
    const used = counter?.used || 0;
    return {
        organization,
        plan: limits.plan,
        limit: limits.candidateInterviews,
        used,
        remaining: Math.max(limits.candidateInterviews - used, 0),
        period,
    };
};

export const reserveCandidateInterview = async (organizationId) => {
    const organization = await Organization.findById(organizationId);
    if (!organization) return { ok: false, reason: "organization_missing" };
    const limits = hiringLimitsFor(organization);
    const period = hiringUsagePeriod(organization);
    const limit = limits.candidateInterviews;
    if (limit <= 0) {
        return { ok: false, reason: "capacity", plan: limits.plan, limit, period: period.key, used: 0 };
    }

    const filter = {
        organization: organization._id,
        metric: METRIC,
        period: period.key,
        used: { $lt: limit },
    };
    let counter = await OrganizationUsageCounter.findOneAndUpdate(
        filter,
        { $inc: { used: 1 } },
        { new: true },
    );
    if (!counter) {
        try {
            counter = await OrganizationUsageCounter.create({
                organization: organization._id,
                metric: METRIC,
                period: period.key,
                used: 1,
            });
        } catch {
            counter = await OrganizationUsageCounter.findOneAndUpdate(
                filter,
                { $inc: { used: 1 } },
                { new: true },
            );
        }
    }
    if (!counter) {
        const current = await OrganizationUsageCounter.findOne({
            organization: organization._id,
            metric: METRIC,
            period: period.key,
        }).lean();
        return {
            ok: false,
            reason: "capacity",
            plan: limits.plan,
            limit,
            period: period.key,
            used: current?.used || limit,
        };
    }

    return {
        ok: true,
        plan: limits.plan,
        limit,
        period: period.key,
        used: counter.used,
        reservation: { counterId: counter._id },
    };
};

export const releaseOrganizationUsage = async (reservation) => {
    if (!reservation?.counterId) return;
    await OrganizationUsageCounter.updateOne(
        { _id: reservation.counterId, used: { $gt: 0 } },
        { $inc: { used: -1 } },
    ).catch(() => {});
};
''')

# Candidate starts, not assessment definitions, consume Hiring credits.
assessment_path = ROOT / 'server/src/controllers/assessmentController.js'
assessment_text = assessment_path.read_text()
if 'reserveCandidateInterview' not in assessment_text:
    assessment_text = assessment_text.replace(
        'import CandidateAttempt from "../models/CandidateAttempt.js";\n',
        'import CandidateAttempt from "../models/CandidateAttempt.js";\nimport { reserveCandidateInterview, releaseOrganizationUsage } from "../services/organizationUsage.js";\n',
    )
start_pattern = re.compile(r'export const startCandidateAttempt = async \(req, res, next\) => \{.*?\n\};\n\nexport const recordIntegrityEvent', re.S)
start_replacement = '''export const startCandidateAttempt = async (req, res, next) => {
    let usageReservation = null;
    let attemptSaved = false;
    try {
        const assessment = await findPublicAssessment(req.params.shareToken);
        if (!assessment) { observeCandidateAction("start", "unavailable", null); return res.status(404).json({ message: "Assessment unavailable" }); }
        const candidateEmail = req.body.email.toLowerCase().trim();
        const activeInvitation = assessment.invitations?.find((item) => item.email === candidateEmail && item.status !== "revoked");
        if (assessment.inviteOnly && !activeInvitation) return res.status(403).json({ message: "This assessment is invitation-only. Use the email address that was invited." });
        const existing = await CandidateAttempt.findOne({ assessment: assessment._id, candidateEmail });
        if (existing) { observeCandidateAction("start", "duplicate", assessment); return res.status(409).json({ message: existing.status === "submitted" ? "This email has already submitted an attempt" : "An attempt for this email is already in progress. Continue from the browser where it was started or contact the recruiting team." }); }

        const usage = await reserveCandidateInterview(assessment.organization);
        if (!usage.ok) {
            observeCandidateAction("start", "capacity", assessment);
            return res.status(429).json({
                message: "This assessment is temporarily unavailable because the hiring team has reached its candidate interview capacity. Contact the recruiting team if you need help.",
                code: "HIRING_CAPACITY_REACHED",
            });
        }
        usageReservation = usage.reservation;

        const rawToken = crypto.randomBytes(32).toString("base64url");
        const rounds = assessment.rounds.map((round) => ({ name: round.name, description: round.description, deliveryMode: round.deliveryMode || "conversational", questions: round.questions.map((question) => ({ text: question.text, weight: question.weight, competencies: question.competencies, knockout: question.knockout })) }));
        const attempt = new CandidateAttempt({ assessment: assessment._id, candidateEmail });
        attempt.candidateName = req.body.name.trim(); attempt.accessTokenHash = tokenHash(rawToken); attempt.rounds = rounds; attempt.status = "started"; attempt.startedAt = new Date();
        if (assessment.integrity?.enabled && req.body.integrityConsent) attempt.integrityConsentAt = new Date();
        const invitation = activeInvitation;
        if (invitation) invitation.status = "started";
        await attempt.save();
        attemptSaved = true;
        if (invitation) {
            try { await assessment.save(); } catch (error) { console.warn("Could not update invitation start status", error?.message || error); }
        }
        observeCandidateAction("start", "success", assessment);
        return res.status(201).json({ attemptToken: rawToken, attempt: publicAttempt(attempt) });
    } catch (error) {
        if (usageReservation && !attemptSaved) await releaseOrganizationUsage(usageReservation);
        observeCandidateAction("start", "failure", null);
        return next(error);
    }
};

export const recordIntegrityEvent'''
assessment_text, count = start_pattern.subn(start_replacement, assessment_text)
if count != 1:
    raise RuntimeError(f'Expected one startCandidateAttempt function, found {count}')
assessment_path.write_text(assessment_text)

# ---------------------------------------------------------------------------
# 4) Organization creation, views and trials.
# ---------------------------------------------------------------------------
replace(
    'server/src/controllers/organizationController.js',
    'import User from "../models/User.js";\n',
    'import User from "../models/User.js";\nimport { activeHiringPlan } from "../services/hiringEntitlements.js";\n'
)
replace(
    'server/src/controllers/organizationController.js',
    '    memberCount,\n    createdAt: membership.organization.createdAt,',
    '    memberCount,\n    hiringPlan: activeHiringPlan(membership.organization),\n    hiringSubscriptionStatus: membership.organization.hiringSubscriptionStatus,\n    createdAt: membership.organization.createdAt,'
)
replace(
    'server/src/controllers/organizationController.js',
    '    try {\n        const organization = await Organization.create({\n            name: req.body.name,\n            createdBy: req.user._id,\n        });',
    '    try {\n        const existingCreatedOrganizations = await Organization.countDocuments({ createdBy: req.user._id });\n        const organization = await Organization.create({\n            name: req.body.name,\n            createdBy: req.user._id,\n            hiringTrialEligible: existingCreatedOrganizations === 0,\n        });'
)

# ---------------------------------------------------------------------------
# 5) Product-aware Stripe catalog, routes and webhook synchronization.
# ---------------------------------------------------------------------------
write('server/src/services/billingCatalog.js', '''import { getStripe } from "../config/stripe.js";

const cached = new Map();
const CACHE_MS = 5 * 60 * 1000;

const priceIds = () => ({
    practice: {
        pro: process.env.STRIPE_PRACTICE_PRO_PRICE_ID || process.env.STRIPE_PRO_PRICE_ID || "",
    },
    hiring: {
        starter: process.env.STRIPE_HIRING_STARTER_PRICE_ID || "",
        growth: process.env.STRIPE_HIRING_GROWTH_PRICE_ID || process.env.STRIPE_SCALE_PRICE_ID || "",
    },
});

export const clearBillingCatalogCache = () => { cached.clear(); };
export const getConfiguredPriceId = (product, plan) => priceIds()?.[product]?.[plan] || "";

export async function getPlanPrice(product, plan, stripe = getStripe()) {
    const priceId = getConfiguredPriceId(product, plan);
    if (!priceId) return null;
    const cacheKey = `${product}:${plan}`;
    const entry = cached.get(cacheKey);
    if (entry && Date.now() - entry.loadedAt < CACHE_MS) return entry.value;
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active || price.type !== "recurring" || !price.recurring || !Number.isInteger(price.unit_amount)) {
        throw Object.assign(new Error(`Configured ${product} ${plan} price must be an active fixed recurring price`), { statusCode: 503 });
    }
    const value = {
        id: price.id,
        unitAmount: price.unit_amount,
        currency: price.currency,
        interval: price.recurring.interval,
        intervalCount: price.recurring.interval_count || 1,
    };
    cached.set(cacheKey, { loadedAt: Date.now(), value });
    return value;
}
''')

write('server/src/routes/billingRoutes.js', '''import express from "express";
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
''')

write('server/src/controllers/billingWebhookController.js', '''import BillingEvent from "../models/BillingEvent.js";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import { getStripe } from "../config/stripe.js";
import { getConfiguredPriceId } from "../services/billingCatalog.js";
import metrics from "../metrics/index.js";

const activeStatuses = new Set(["active", "trialing"]);

const priceIdOf = (subscription) => subscription.items?.data?.[0]?.price?.id || "";

const practicePlanFromSubscription = (subscription) => {
    const priceId = priceIdOf(subscription);
    if (priceId && priceId === getConfiguredPriceId("practice", "pro")) return "pro";
    return subscription.metadata?.plan === "pro" ? "pro" : "pro";
};

const hiringPlanFromSubscription = (subscription) => {
    const priceId = priceIdOf(subscription);
    if (priceId && priceId === getConfiguredPriceId("hiring", "starter")) return "starter";
    if (priceId && priceId === getConfiguredPriceId("hiring", "growth")) return "growth";
    return ["starter", "growth", "enterprise"].includes(subscription.metadata?.plan)
        ? subscription.metadata.plan
        : "starter";
};

const currentPeriodEnd = (subscription) => subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;

const syncPracticeSubscription = async (subscription) => {
    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
    const userId = subscription.metadata?.userId;
    const filter = userId ? { _id: userId } : { practiceBillingCustomerId: customerId };
    if (!userId && !customerId) return;
    await User.updateOne(filter, {
        $set: {
            practiceBillingProvider: "stripe",
            practiceBillingCustomerId: customerId || "",
            practiceBillingSubscriptionId: subscription.id,
            practiceSubscriptionStatus: subscription.status,
            practicePlan: practicePlanFromSubscription(subscription),
            practiceCurrentPeriodEnd: currentPeriodEnd(subscription),
        },
    });
};

const syncHiringSubscription = async (subscription) => {
    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
    const organizationId = subscription.metadata?.organizationId;
    const filter = organizationId ? { _id: organizationId } : { hiringBillingCustomerId: customerId };
    if (!organizationId && !customerId) return;
    const update = {
        hiringBillingProvider: "stripe",
        hiringBillingCustomerId: customerId || "",
        hiringBillingSubscriptionId: subscription.id,
        hiringSubscriptionStatus: subscription.status,
        hiringPlan: hiringPlanFromSubscription(subscription),
        hiringCurrentPeriodEnd: currentPeriodEnd(subscription),
    };
    if (activeStatuses.has(subscription.status)) update.hiringTrialEligible = false;
    await Organization.updateOne(filter, { $set: update });
};

const syncSubscription = async (subscription) => {
    const product = subscription.metadata?.billingProduct;
    if (product === "practice") await syncPracticeSubscription(subscription);
    else if (product === "hiring") await syncHiringSubscription(subscription);
    else throw new Error("Subscription is missing billingProduct metadata");
    metrics.billingSubscriptionTransitionsTotal.labels(subscription.status || "unknown").inc();
};

const syncInvoiceSubscription = async (invoice) => {
    if (!invoice.subscription) return;
    const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id;
    if (!subscriptionId) return;
    await syncSubscription(await getStripe().subscriptions.retrieve(subscriptionId));
};

export const stripeWebhook = async (req, res) => {
    const startedAt = process.hrtime.bigint();
    let event;
    try {
        const signature = req.get("stripe-signature");
        if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(400).send("Webhook signature configuration missing");
        event = getStripe().webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
        metrics.billingWebhooksTotal.labels("unknown", "invalid_signature").inc();
        metrics.billingWebhookDurationSeconds.labels("unknown", "invalid_signature").observe(Number(process.hrtime.bigint() - startedAt) / 1e9);
        return res.status(400).send(`Invalid webhook: ${error.message}`);
    }

    try {
        await BillingEvent.create({ provider: "stripe", eventId: event.id, type: event.type });
    } catch (error) {
        if (error?.code === 11000) {
            metrics.billingWebhooksTotal.labels(event.type, "duplicate").inc();
            metrics.billingWebhookDurationSeconds.labels(event.type, "duplicate").observe(Number(process.hrtime.bigint() - startedAt) / 1e9);
            return res.json({ received: true, duplicate: true });
        }
        throw error;
    }

    try {
        if (event.type === "checkout.session.completed") {
            const session = event.data.object;
            const product = session.metadata?.billingProduct;
            if (product === "practice") {
                const userId = session.client_reference_id || session.metadata?.userId;
                await User.updateOne({ _id: userId }, { $set: {
                    practiceBillingProvider: "stripe",
                    practiceBillingCustomerId: session.customer || "",
                    practiceBillingSubscriptionId: session.subscription || "",
                } });
            } else if (product === "hiring") {
                const organizationId = session.metadata?.organizationId || session.client_reference_id;
                await Organization.updateOne({ _id: organizationId }, { $set: {
                    hiringBillingProvider: "stripe",
                    hiringBillingCustomerId: session.customer || "",
                    hiringBillingSubscriptionId: session.subscription || "",
                } });
            } else {
                throw new Error("Checkout session is missing billingProduct metadata");
            }
            if (session.subscription) {
                const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
                await syncSubscription(await getStripe().subscriptions.retrieve(subscriptionId));
            }
        } else if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
            await syncSubscription(event.data.object);
        } else if (["invoice.payment_failed", "invoice.payment_succeeded"].includes(event.type)) {
            await syncInvoiceSubscription(event.data.object);
        } else if (["charge.dispute.created", "charge.refunded"].includes(event.type)) {
            const charge = event.data.object;
            if (charge.customer) {
                await Promise.all([
                    User.updateOne({ practiceBillingCustomerId: charge.customer }, { $set: { practiceSubscriptionStatus: "past_due" } }),
                    Organization.updateOne({ hiringBillingCustomerId: charge.customer }, { $set: { hiringSubscriptionStatus: "past_due", hiringTrialEligible: false } }),
                ]);
            }
        }
        metrics.billingWebhooksTotal.labels(event.type, "success").inc();
        metrics.billingWebhookDurationSeconds.labels(event.type, "success").observe(Number(process.hrtime.bigint() - startedAt) / 1e9);
        return res.json({ received: true });
    } catch (error) {
        await BillingEvent.deleteOne({ provider: "stripe", eventId: event.id }).catch(() => {});
        console.error("Stripe webhook processing failed", event.id, error);
        metrics.billingWebhooksTotal.labels(event.type, "failure").inc();
        metrics.billingWebhookDurationSeconds.labels(event.type, "failure").observe(Number(process.hrtime.bigint() - startedAt) / 1e9);
        return res.status(500).json({ message: "Webhook processing failed" });
    }
};
''')

# ---------------------------------------------------------------------------
# 6) Account deletion cannot orphan paid subscriptions.
# ---------------------------------------------------------------------------
auth_path = ROOT / 'server/src/controllers/authController.js'
auth_text = auth_path.read_text()
auth_text = auth_text.replace('PracticeUsageCounter.deleteMany({ user: user._id })', 'PracticeUsageCounter.deleteMany({ user: user._id })')
auth_text = auth_text.replace(
    '        if (user.provider === "local" && (!password || !await user.matchPassword(password))) {\n            return res.status(400).json({ message: "Current password is incorrect" });\n        }\n\n        const interviews = await Interview.find({ user: user._id }).select("rounds.round").lean();',
    '        if (user.provider === "local" && (!password || !await user.matchPassword(password))) {\n            return res.status(400).json({ message: "Current password is incorrect" });\n        }\n        if (["active", "trialing"].includes(user.practiceSubscriptionStatus)) {\n            return res.status(409).json({ message: "Cancel your active Practice subscription before deleting your account" });\n        }\n\n        const interviews = await Interview.find({ user: user._id }).select("rounds.round").lean();'
)
auth_text = auth_text.replace(
    '        for (const organizationId of ownedOrganizationIds) {\n            const activeMembers = await OrganizationMembership.countDocuments({ organization: organizationId, status: "active" });',
    '        const ownedOrganizations = ownedOrganizationIds.length\n            ? await Organization.find({ _id: { $in: ownedOrganizationIds } }).select("_id hiringSubscriptionStatus").lean()\n            : [];\n        if (ownedOrganizations.some((organization) => ["active", "trialing"].includes(organization.hiringSubscriptionStatus))) {\n            return res.status(409).json({ message: "Cancel Hiring billing or transfer organization ownership before deleting your account" });\n        }\n        for (const organizationId of ownedOrganizationIds) {\n            const activeMembers = await OrganizationMembership.countDocuments({ organization: organizationId, status: "active" });'
)
auth_path.write_text(auth_text)

# ---------------------------------------------------------------------------
# 7) Client: Practice pricing is personal; Hiring billing lives in org settings.
# ---------------------------------------------------------------------------
write('client/src/pages/PricingPage.jsx', '''import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Container, Grid, List, ListItem, ListItemText, Stack, Typography } from "@mui/material";
import { CheckCircleOutline } from "@mui/icons-material";
import api from "../api/axios";
import { trackEvent } from "../utils/analytics";

const plans = [
    {
        id: "free",
        name: "Free",
        description: "Build a consistent interview-practice habit.",
        features: ["Progress tracking", "Practice reminders", "Role-specific practice"],
    },
    {
        id: "pro",
        name: "Pro",
        description: "Higher personal limits for active interview preparation.",
        features: ["All interview formats", "Billing management and invoices"],
    },
];

export default function PricingPage() {
    const [params] = useSearchParams();
    const [entitlements, setEntitlements] = useState(null);
    const [entitlementsLoading, setEntitlementsLoading] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const priceLabel = () => {
        const price = entitlements?.prices?.pro;
        return price ? new Intl.NumberFormat(undefined, { style: "currency", currency: price.currency.toUpperCase() }).format(price.unitAmount / 100) : null;
    };
    const intervalLabel = () => {
        const price = entitlements?.prices?.pro;
        return price?.intervalCount > 1 ? `${price.intervalCount} ${price.interval}s` : price?.interval;
    };

    useEffect(() => {
        trackEvent("pricing_viewed", { product: "practice" });
        api.get("/billing/practice/entitlements")
            .then(({ data }) => setEntitlements(data))
            .catch(() => setError("We couldn’t load your Practice plan. Try refreshing the page."))
            .finally(() => setEntitlementsLoading(false));
    }, []);

    const redirect = async (endpoint, body) => {
        try {
            setLoading(true);
            setError("");
            if (endpoint.includes("checkout")) trackEvent("checkout_started", { product: "practice", ...body });
            const { data } = await api.post(endpoint, body);
            if (!data?.url) throw new Error("Missing billing URL");
            window.location.assign(data.url);
        } catch (e) {
            setError(e?.response?.data?.message || "Billing could not be opened.");
            setLoading(false);
        }
    };

    return <Container maxWidth="md" sx={{ py: { xs: 4, md: 7 } }}>
        <Stack alignItems="center" textAlign="center" mb={4}>
            <Typography variant="overline" color="primary.main" fontWeight={850}>CompanionAI Practice</Typography>
            <Typography component="h1" variant="h3" fontWeight={850}>Choose your Practice plan</Typography>
            <Typography color="text.secondary" mt={1}>Practice billing belongs to you personally. Hiring teams have separate organization billing and shared candidate-interview capacity.</Typography>
        </Stack>
        {params.get("checkout") === "cancelled" && <Alert severity="info" sx={{ mb: 3 }}>Checkout was canceled. Nothing was charged.</Alert>}
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        {entitlementsLoading ? <Stack alignItems="center" py={8} role="status"><CircularProgress /><Typography color="text.secondary" mt={2}>Loading Practice plans…</Typography></Stack> : <Grid container spacing={3}>
            {plans.map((plan) => {
                const fallbacks = { free: { interviews: 3, resumeReviews: 3 }, pro: { interviews: 100, resumeReviews: 100 } };
                const planLimits = entitlements?.planLimits?.[plan.id] || (plan.id === entitlements?.plan ? entitlements?.limits : fallbacks[plan.id]);
                const features = [`${planLimits.interviews} practice interviews each month`, `${planLimits.resumeReviews} resume reviews each month`, ...plan.features];
                const current = plan.id === entitlements?.plan;
                const price = plan.id === "pro" ? priceLabel() : null;
                return <Grid size={{ xs: 12, md: 6 }} key={plan.id}><Card variant="outlined" sx={{ height: "100%", borderColor: plan.id === "pro" ? "primary.main" : "divider", display: "flex" }}><CardContent sx={{ p: 3, display: "flex", flexDirection: "column", width: "100%" }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}><Typography variant="h4" fontWeight={850}>{plan.name}</Typography>{plan.id === "pro" && <Chip label="For active preparation" color="primary" />}</Stack>
                    {price && <Typography variant="h5" fontWeight={800} mt={1}>{price}<Typography component="span" color="text.secondary" fontSize="1rem"> / {intervalLabel()}</Typography></Typography>}
                    <Typography color="text.secondary" mt={1}>{plan.description}</Typography>
                    <List>{features.map((feature) => <ListItem key={feature} disableGutters><CheckCircleOutline color="success" sx={{ mr: 1.5 }} /><ListItemText primary={feature} /></ListItem>)}</List>
                    <Box mt="auto" pt={2}>
                        {current ? <Button fullWidth variant="contained" disabled>Current plan</Button>
                            : plan.id === "free" ? <Button fullWidth variant="outlined" disabled>Included access</Button>
                                : entitlements?.plan === "pro" ? <Button fullWidth variant="outlined" disabled={loading} onClick={() => redirect("/billing/practice/portal-session")}>Manage Practice billing</Button>
                                    : <Button fullWidth variant="contained" disabled={loading || !entitlements?.billingAvailable?.pro} onClick={() => redirect("/billing/practice/checkout-session", { plan: "pro" })}>{loading ? "Opening checkout…" : entitlements?.billingAvailable?.pro ? "Choose Pro" : "Checkout not configured"}</Button>}
                    </Box>
                </CardContent></Card></Grid>;
            })}
        </Grid>}
        {entitlements?.plan === "pro" && <Stack alignItems="center" mt={3}><Button onClick={() => redirect("/billing/practice/portal-session")} disabled={loading}>Manage invoices, cancellation, or payment method</Button></Stack>}
    </Container>;
}
''')

write('client/src/pages/BillingSuccessPage.jsx', '''import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { Alert, Button, CircularProgress, Container, Stack, Typography } from "@mui/material";
import api from "../api/axios";

const label = (value) => value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : "Subscription";

export default function BillingSuccessPage() {
    const [params] = useSearchParams();
    const product = params.get("product") === "hiring" ? "hiring" : "practice";
    const organizationId = params.get("organizationId") || "";
    const [status, setStatus] = useState("checking");
    const [activePlan, setActivePlan] = useState("");
    const returnPath = product === "hiring" ? "/hiring/team" : "/dashboard";
    const endpoint = product === "hiring" ? "/billing/hiring/entitlements" : "/billing/practice/entitlements";
    const requestConfig = useMemo(() => product === "hiring" && organizationId
        ? { headers: { "X-Organization-Id": organizationId } }
        : undefined, [organizationId, product]);

    useEffect(() => {
        let stopped = false;
        let attempts = 0;
        const check = async () => {
            try {
                const { data } = await api.get(endpoint, requestConfig);
                const active = product === "hiring"
                    ? ["starter", "growth", "enterprise"].includes(data.plan)
                    : data.plan === "pro";
                if (active) {
                    if (!stopped) {
                        setActivePlan(data.plan);
                        setStatus("active");
                    }
                    return;
                }
            } catch { /* retry while webhook settles */ }
            attempts += 1;
            if (attempts >= 8) return !stopped && setStatus("pending");
            setTimeout(check, 1500);
        };
        check();
        return () => { stopped = true; };
    }, [endpoint, product, requestConfig]);

    return <Container maxWidth="sm" sx={{ py: 10 }}><Stack spacing={3} alignItems="center" textAlign="center">
        {status === "checking" && <><CircularProgress /><Typography component="h1" variant="h4" fontWeight={850}>Confirming your subscription…</Typography><Typography color="text.secondary">Stripe completed checkout. We’re waiting for the signed webhook confirmation.</Typography></>}
        {status === "active" && <><Alert severity="success" sx={{ width: "100%" }}>{product === "hiring" ? `${label(activePlan)} Hiring is active for this organization.` : "Practice Pro is active on your account."}</Alert><Typography component="h1" variant="h4" fontWeight={850}>Your upgraded capacity is ready</Typography></>}
        {status === "pending" && <><Alert severity="info">Payment succeeded, but subscription confirmation is still processing. Refresh shortly or contact support if this persists.</Alert><Typography component="h1" variant="h4" fontWeight={850}>Confirmation pending</Typography></>}
        <Button component={RouterLink} to={returnPath} variant="contained">Continue to {product === "hiring" ? "Hiring" : "Practice"}</Button>
    </Stack></Container>;
}
''')

# Dashboard and Profile refer only to Practice billing.
replace('client/src/pages/DashboardPage.jsx', 'api.get("/billing/entitlements")', 'api.get("/billing/practice/entitlements")')
replace(
    'client/src/pages/DashboardPage.jsx',
    '<strong>{entitlements.plan === "pro" ? "Pro" : entitlements.plan === "scale" ? "Scale" : "Free"} plan:</strong>',
    '<strong>{entitlements.plan === "pro" ? "Practice Pro" : "Practice Free"}:</strong>'
)
replace(
    'client/src/pages/DashboardPage.jsx',
    ' Hiring assessment usage is available in the Hiring workspace.',
    ' Hiring capacity is billed separately to each organization.'
)
replace('client/src/pages/ProfilePage.jsx', 'user?.plan ? `${user.plan.charAt(0).toUpperCase()}${user.plan.slice(1)} plan` : "Your plan"', 'user?.practicePlan ? `Practice ${user.practicePlan.charAt(0).toUpperCase()}${user.practicePlan.slice(1)}` : "Your Practice plan"')
replace('client/src/pages/ProfilePage.jsx', 'Review usage limits, invoices, upgrades, and cancellation.', 'Manage your personal Practice usage, invoices, upgrades, and cancellation. Hiring billing belongs to each organization.')
replace('client/src/pages/ProfilePage.jsx', 'Download a JSON copy of your profile, practice interviews, candidate assessments and reports, reviews, saved experiences, feedback, and reminder history.', 'Download a JSON copy of your profile, practice interviews, reviews, saved experiences, feedback, and reminder history. Organization-owned Hiring data is not part of your personal export.')

# Hiring settings keep existing team behavior and add organization billing/usage.
hiring_team = read('client/src/pages/HiringTeamPage.jsx')
hiring_team = hiring_team.replace(
    'import { Alert, Box, Button, Chip, Container, Divider, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";',
    'import { Alert, Box, Button, Chip, Container, Divider, FormControl, InputLabel, LinearProgress, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";'
)
hiring_team = hiring_team.replace(
    '    const [adding, setAdding] = useState(false);\n    const canManage = ["owner", "admin"].includes(currentRole);',
    '    const [adding, setAdding] = useState(false);\n    const [billing, setBilling] = useState(null);\n    const [billingLoading, setBillingLoading] = useState(false);\n    const [billingActionLoading, setBillingActionLoading] = useState(false);\n    const canManage = ["owner", "admin"].includes(currentRole);'
)
hiring_team = hiring_team.replace(
    '    useEffect(() => {\n        loadMembers();\n    }, [activeOrganization?._id]); // eslint-disable-line react-hooks/exhaustive-deps\n',
    '''    useEffect(() => {
        loadMembers();
    }, [activeOrganization?._id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!activeOrganization?._id) return;
        setBillingLoading(true);
        api.get("/billing/hiring/entitlements")
            .then(({ data }) => setBilling(data))
            .catch((err) => setError(err?.response?.data?.message || "Could not load Hiring plan"))
            .finally(() => setBillingLoading(false));
    }, [activeOrganization?._id]);
'''
)
hiring_team = hiring_team.replace(
    '    const createAnotherOrganization = async (event) => {',
    '''    const billingRedirect = async (endpoint, body) => {
        try {
            setBillingActionLoading(true);
            setError("");
            const { data } = await api.post(endpoint, body);
            if (!data?.url) throw new Error("Missing billing URL");
            window.location.assign(data.url);
        } catch (err) {
            setError(err?.response?.data?.message || "Could not open Hiring billing");
            setBillingActionLoading(false);
        }
    };

    const formatPrice = (plan) => {
        const price = billing?.prices?.[plan];
        if (!price) return null;
        const amount = new Intl.NumberFormat(undefined, { style: "currency", currency: price.currency.toUpperCase() }).format(price.unitAmount / 100);
        const interval = price.intervalCount > 1 ? `${price.intervalCount} ${price.interval}s` : price.interval;
        return `${amount} / ${interval}`;
    };

    const planLabel = (plan) => ({ none: "No plan", trial: "Trial", starter: "Starter", growth: "Growth", enterprise: "Enterprise" }[plan] || plan);

    const createAnotherOrganization = async (event) => {'''
)
hiring_team = hiring_team.replace(
    '<Typography component="h1" variant="h3" fontWeight={850} letterSpacing="-.035em">Team & organization</Typography>\n                    <Typography color="text.secondary" mt={1}>Manage who can create assessments, review candidates, and administer your hiring workspace.</Typography>',
    '<Typography component="h1" variant="h3" fontWeight={850} letterSpacing="-.035em">Organization settings</Typography>\n                    <Typography color="text.secondary" mt={1}>Manage your team, shared candidate-interview capacity, and organization billing.</Typography>'
)

billing_section = '''
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 4 }}>
                    <Typography variant="h5" fontWeight={800}>Plan & billing</Typography>
                    <Typography color="text.secondary" mt={.5}>Hiring billing belongs to {activeOrganization?.name}. Every member uses the same organization capacity; personal Practice plans do not affect it.</Typography>
                    {billingLoading ? <Typography color="text.secondary" mt={2}>Loading Hiring usage…</Typography> : billing && <Stack spacing={2.5} mt={2.5}>
                        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2} alignItems={{ md: "center" }}>
                            <Box>
                                <Stack direction="row" spacing={1} alignItems="center"><Typography variant="h6" fontWeight={800}>{planLabel(billing.plan)} Hiring</Typography><Chip size="small" label={billing.periodType === "lifetime" ? "Lifetime trial credits" : "Monthly capacity"} /></Stack>
                                <Typography variant="body2" color="text.secondary" mt={.5}>{billing.used.candidateInterviews} of {billing.limits.candidateInterviews} candidate interviews used{billing.periodType === "month" ? ` in ${billing.period}` : ""}.</Typography>
                            </Box>
                            {billing.canManageBilling && ["starter", "growth", "enterprise"].includes(billing.plan) && <Button variant="outlined" disabled={billingActionLoading} onClick={() => billingRedirect("/billing/hiring/portal-session")}>Manage billing</Button>}
                        </Stack>
                        <LinearProgress variant="determinate" value={billing.limits.candidateInterviews > 0 ? Math.min(100, (billing.used.candidateInterviews / billing.limits.candidateInterviews) * 100) : 100} sx={{ height: 8, borderRadius: 99 }} />
                        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                            {["starter", "growth"].map((plan) => {
                                const limit = billing.planLimits?.[plan]?.candidateInterviews;
                                const current = billing.plan === plan;
                                return <Paper key={plan} variant="outlined" sx={{ p: 2, flex: 1, borderColor: current ? "primary.main" : "divider" }}><Typography fontWeight={800}>{planLabel(plan)}</Typography><Typography variant="h6" mt={.5}>{limit} candidate interviews / month</Typography>{formatPrice(plan) && <Typography color="text.secondary">{formatPrice(plan)}</Typography>}<Button sx={{ mt: 1.5 }} fullWidth variant={plan === "growth" ? "contained" : "outlined"} disabled={!billing.canManageBilling || current || billingActionLoading || !billing.billingAvailable?.[plan]} onClick={() => billingRedirect("/billing/hiring/checkout-session", { plan })}>{current ? "Current plan" : billing.billingAvailable?.[plan] ? `Choose ${planLabel(plan)}` : "Checkout not configured"}</Button></Paper>;
                            })}
                            <Paper variant="outlined" sx={{ p: 2, flex: 1 }}><Typography fontWeight={800}>Enterprise</Typography><Typography variant="h6" mt={.5}>Custom capacity</Typography><Typography color="text.secondary">Custom contracts, SSO/API and retention controls can be added when enterprise demand is validated.</Typography><Button sx={{ mt: 1.5 }} fullWidth variant="outlined" disabled>Contact sales</Button></Paper>
                        </Stack>
                        {!billing.canManageBilling && <Alert severity="info">Only organization Owners and Admins can change Hiring billing. Your role can still see shared usage.</Alert>}
                    </Stack>}
                </Paper>
'''
anchor = '                <Paper component="form" variant="outlined" sx={{ p: 3, borderRadius: 4 }} onSubmit={createAnotherOrganization}>'
if anchor not in hiring_team:
    raise RuntimeError('Could not find create organization section in HiringTeamPage')
hiring_team = hiring_team.replace(anchor, billing_section + '\n' + anchor)
write('client/src/pages/HiringTeamPage.jsx', hiring_team)

# ---------------------------------------------------------------------------
# 8) Tests: new names, APIs, shared org usage and product-aware success.
# ---------------------------------------------------------------------------
# Server test imports/symbols were rewritten by generic model/service passes.
server_test = ROOT / 'server/src/test/e2e/happyFlows.test.js'
text = server_test.read_text()
text = text.replace('expect(profile.body.plan).toBe("free");', 'expect(profile.body.practicePlan).toBe("free");')
text = text.replace('/api/billing/entitlements', '/api/billing/practice/entitlements')
text = text.replace('        expect(entitlements.body.limits.assessments).toBe(PRACTICE_PLAN_LIMITS.free.assessmentsPerMonth);\n', '')
if 'OrganizationUsageCounter' not in text:
    text = text.replace(
        'import CandidateAttempt from "../../models/CandidateAttempt.js";\n',
        'import CandidateAttempt from "../../models/CandidateAttempt.js";\nimport OrganizationUsageCounter from "../../models/OrganizationUsageCounter.js";\nimport OrganizationMembership from "../../models/OrganizationMembership.js";\n',
    )
if 'HIRING_PLAN_LIMITS' not in text:
    text = text.replace(
        'import { currentMonth, PRACTICE_PLAN_LIMITS } from "../../services/practiceEntitlements.js";\n',
        'import { currentMonth, PRACTICE_PLAN_LIMITS } from "../../services/practiceEntitlements.js";\nimport { HIRING_PLAN_LIMITS } from "../../services/hiringEntitlements.js";\n',
    )
# Practice Pro cannot upgrade Hiring entitlement.
trial_assert_anchor = '        auth["X-Organization-Id"] = hiringOrganization.body.organization._id;\n\n        // Create minimal resume directly via model (avoids Cloudinary)'
trial_assert = '''        auth["X-Organization-Id"] = hiringOrganization.body.organization._id;
        await User.updateOne({ _id: login.body.user?._id || u._id }, { $set: { practicePlan: "pro", practiceSubscriptionStatus: "active" } });
        const hiringTrialEntitlements = await agent.get("/api/billing/hiring/entitlements").set(auth).expect(200);
        expect(hiringTrialEntitlements.body).toMatchObject({ plan: "trial", limits: { candidateInterviews: HIRING_PLAN_LIMITS.trial.candidateInterviews } });
        const personalPracticeEntitlements = await agent.get("/api/billing/practice/entitlements").set(auth).expect(200);
        expect(personalPracticeEntitlements.body.plan).toBe("pro");
        await User.updateOne({ _id: login.body.user?._id || u._id }, { $set: { practicePlan: "free", practiceSubscriptionStatus: "inactive" } });

        // Create minimal resume directly via model (avoids Cloudinary)'''
if trial_assert_anchor not in text:
    raise RuntimeError('Could not insert independent Practice/Hiring entitlement assertion')
text = text.replace(trial_assert_anchor, trial_assert)
# Member of same organization sees same shared usage after candidate starts.
start_anchor = '        expect(startedAttempt.body.attempt.rounds[0].deliveryMode).toBe("conversational");\n'
shared_assert = '''        expect(startedAttempt.body.attempt.rounds[0].deliveryMode).toBe("conversational");
        const orgUsage = await OrganizationUsageCounter.findOne({ organization: hiringOrganization.body.organization._id, metric: "candidateInterviews", period: "lifetime" }).lean();
        expect(orgUsage).toMatchObject({ used: 1 });
        await OrganizationMembership.create({ organization: hiringOrganization.body.organization._id, user: otherUser._id, role: "reviewer", status: "active" });
        const otherAcmeAuth = { ...otherAuth, "X-Organization-Id": hiringOrganization.body.organization._id };
        const sharedHiringEntitlements = await agent.get("/api/billing/hiring/entitlements").set(otherAcmeAuth).expect(200);
        expect(sharedHiringEntitlements.body).toMatchObject({ plan: "trial", used: { candidateInterviews: 1 } });
'''
if start_anchor not in text:
    raise RuntimeError('Could not insert shared Hiring usage assertion')
text = text.replace(start_anchor, shared_assert, 1)
# Additional organization from same creator is not granted another free trial.
second_org_anchor = '        const me = await User.findOne({ email: "t@example.com" });\n'
second_org_assert = '''        const me = await User.findOne({ email: "t@example.com" });
        const secondOrganization = await agent.post("/api/organizations").set(auth).set("origin", origin).set("referer", `${origin}/`).send({ name: "Second Hiring Org" }).expect(201);
        const secondOrgAuth = { ...auth, "X-Organization-Id": secondOrganization.body.organization._id };
        const secondOrgEntitlements = await agent.get("/api/billing/hiring/entitlements").set(secondOrgAuth).expect(200);
        expect(secondOrgEntitlements.body).toMatchObject({ plan: "none", limits: { candidateInterviews: 0 } });
'''
if second_org_anchor not in text:
    raise RuntimeError('Could not insert second organization trial assertion')
text = text.replace(second_org_anchor, second_org_assert, 1)
# Practice limit error code changed and remains personal.
text = text.replace('code: "PLAN_LIMIT_REACHED"', 'code: "PRACTICE_LIMIT_REACHED"')
server_test.write_text(text)

write('client/src/__tests__/billingSuccessPage.test.jsx', '''import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import api from "../api/axios";
import BillingSuccessPage from "../pages/BillingSuccessPage";

vi.mock("../api/axios", () => ({ default: { get: vi.fn() } }));

describe("BillingSuccessPage", () => {
    it("recognizes Hiring Growth checkout for the selected organization", async () => {
        api.get.mockResolvedValue({ data: { plan: "growth" } });
        render(<MemoryRouter initialEntries={["/billing/success?product=hiring&organizationId=org-1"]}><BillingSuccessPage /></MemoryRouter>);
        expect(await screen.findByText("Growth Hiring is active for this organization.")).toBeTruthy();
        expect(screen.getByRole("link", { name: "Continue to Hiring" }).getAttribute("href")).toBe("/hiring/team");
        expect(api.get).toHaveBeenCalledWith("/billing/hiring/entitlements", { headers: { "X-Organization-Id": "org-1" } });
    });

    it("recognizes personal Practice Pro checkout", async () => {
        api.get.mockResolvedValue({ data: { plan: "pro" } });
        render(<MemoryRouter initialEntries={["/billing/success?product=practice"]}><BillingSuccessPage /></MemoryRouter>);
        expect(await screen.findByText("Practice Pro is active on your account.")).toBeTruthy();
        expect(screen.getByRole("link", { name: "Continue to Practice" }).getAttribute("href")).toBe("/dashboard");
    });
});
''')

# E2E mocks and assertions.
e2e = ROOT / 'client/e2e/productJourneys.spec.js'
e2e_text = e2e.read_text()
e2e_text = e2e_text.replace('role: "user", plan: "free"', 'role: "user", practicePlan: "free"')
e2e_text = e2e_text.replace('role: "user", plan: "free"', 'role: "user", practicePlan: "free"')
e2e_text = e2e_text.replace('**/api/billing/entitlements', '**/api/billing/practice/entitlements')
e2e_text = e2e_text.replace('{ plan: "free", limits: { interviews: 3, resumeReviews: 3, assessments: 2 }, planLimits: {}, prices: {}, billingAvailable: {} }', '{ plan: "free", limits: { interviews: 3, resumeReviews: 3 }, used: { interviews: 0, resumeReviews: 0 }, planLimits: {}, prices: {}, billingAvailable: {} }')
e2e_text = e2e_text.replace('{ plan: "scale", limits: { interviews: 1000, resumeReviews: 1000, assessments: 500 }, planLimits: {}, prices: {}, billingAvailable: {} }', '{ plan: "pro", limits: { interviews: 100, resumeReviews: 100 }, used: { interviews: 0, resumeReviews: 0 }, planLimits: {}, prices: {}, billingAvailable: {} }')
e2e_text = e2e_text.replace('await expect(page.getByRole("heading", { name: "Choose the capacity you need" })).toBeVisible();', 'await expect(page.getByRole("heading", { name: "Choose your Practice plan" })).toBeVisible();')
# Give all signed-in Hiring screens a deterministic organization billing response.
mock_org_anchor = '''    await page.route("**/api/organizations", (route) => json(route, {
        organizations: [{ _id: "org-1", name: "Acme Hiring", role: organizationRole, memberCount: 1 }],
    }));
'''
mock_org_replacement = mock_org_anchor + '''    await page.route("**/api/billing/hiring/entitlements", (route) => json(route, {
        product: "hiring",
        organization: { _id: "org-1", name: "Acme Hiring" },
        plan: "trial",
        subscriptionStatus: "inactive",
        period: "lifetime",
        periodType: "lifetime",
        limits: { candidateInterviews: 5 },
        used: { candidateInterviews: 1 },
        planLimits: { trial: { candidateInterviews: 5 }, starter: { candidateInterviews: 25 }, growth: { candidateInterviews: 100 }, enterprise: { candidateInterviews: 100000 } },
        prices: {},
        billingAvailable: {},
        canManageBilling: ["owner", "admin"].includes(organizationRole),
    }));
'''
if mock_org_anchor not in e2e_text:
    raise RuntimeError('Could not extend mockSignedIn with Hiring billing')
e2e_text = e2e_text.replace(mock_org_anchor, mock_org_replacement, 1)
e2e.write_text(e2e_text)

# ---------------------------------------------------------------------------
# 9) Environment/documentation contract.
# ---------------------------------------------------------------------------
env_path = ROOT / 'server/.env.example'
env_text = env_path.read_text()
old_env = '''# Product plans / billing readiness
FREE_INTERVIEWS_PER_MONTH=3
FREE_RESUME_REVIEWS_PER_MONTH=3
FREE_ASSESSMENTS_PER_MONTH=2
PRO_INTERVIEWS_PER_MONTH=100
PRO_RESUME_REVIEWS_PER_MONTH=100
PRO_ASSESSMENTS_PER_MONTH=50
SCALE_INTERVIEWS_PER_MONTH=1000
SCALE_RESUME_REVIEWS_PER_MONTH=1000
SCALE_ASSESSMENTS_PER_MONTH=500
# Required before billingAvailable becomes true. Checkout/webhook adapter can map provider status to User plan fields.
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=price_your_recurring_pro_price
STRIPE_SCALE_PRICE_ID=price_your_recurring_scale_price
'''
new_env = '''# Practice plans (user-owned)
FREE_INTERVIEWS_PER_MONTH=3
FREE_RESUME_REVIEWS_PER_MONTH=3
PRO_INTERVIEWS_PER_MONTH=100
PRO_RESUME_REVIEWS_PER_MONTH=100

# Hiring plans (organization-owned; assessment definitions are not metered)
HIRING_TRIAL_CANDIDATE_INTERVIEWS=5
HIRING_STARTER_CANDIDATE_INTERVIEWS_PER_MONTH=25
HIRING_GROWTH_CANDIDATE_INTERVIEWS_PER_MONTH=100
HIRING_ENTERPRISE_CANDIDATE_INTERVIEWS_PER_MONTH=100000

# Stripe. Practice and Hiring use separate recurring prices/customers.
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRACTICE_PRO_PRICE_ID=price_your_practice_pro_price
STRIPE_HIRING_STARTER_PRICE_ID=price_your_hiring_starter_price
STRIPE_HIRING_GROWTH_PRICE_ID=price_your_hiring_growth_price
'''
if old_env not in env_text:
    raise RuntimeError('Expected old billing env section not found')
env_path.write_text(env_text.replace(old_env, new_env))

# ---------------------------------------------------------------------------
# 10) Guards: do not leave the old mixed billing architecture in product code.
# ---------------------------------------------------------------------------
for path in (ROOT / 'server/src').rglob('*.js'):
    text = path.read_text()
    forbidden = [
        'models/UsageCounter.js',
        'services/entitlements.js',
        'middleware/usageLimit.js',
        'assessmentsPerMonth',
        'FREE_ASSESSMENTS_PER_MONTH',
        'PRO_ASSESSMENTS_PER_MONTH',
        'SCALE_ASSESSMENTS_PER_MONTH',
    ]
    for token in forbidden:
        if token in text:
            raise RuntimeError(f'Legacy mixed billing token {token!r} remains in {path}')

# Old generic user fields should not remain outside explicit response keys named
# "plan" or "subscriptionStatus" in product entitlement payloads.
for path in [ROOT / 'server/src/models/User.js', ROOT / 'server/src/middleware/authMiddleware.js', ROOT / 'server/src/controllers/authController.js']:
    text = path.read_text()
    for token in [' billingCustomerId', ' billingSubscriptionId', ' billingProvider']:
        if token in text:
            raise RuntimeError(f'Legacy user billing field remains in {path}: {token}')

print('Monetization split applied successfully.')
