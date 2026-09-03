import BillingEvent from "../models/BillingEvent.js";
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
