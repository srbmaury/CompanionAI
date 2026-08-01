import BillingEvent from "../models/BillingEvent.js";
import User from "../models/User.js";
import { getStripe } from "../config/stripe.js";
import metrics from "../metrics/index.js";

const activeStatuses = new Set(["active", "trialing"]);
const syncSubscription = async (subscription) => {
    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
    const userId = subscription.metadata?.userId;
    const filter = userId ? { _id: userId } : { billingCustomerId: customerId };
    if (!userId && !customerId) return;
    await User.updateOne(filter, { $set: { billingProvider: "stripe", billingCustomerId: customerId || "", billingSubscriptionId: subscription.id, subscriptionStatus: subscription.status, plan: activeStatuses.has(subscription.status) ? "pro" : "free" } });
    metrics.billingSubscriptionTransitionsTotal.labels(subscription.status || "unknown").inc();
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
            const userId = session.client_reference_id || session.metadata?.userId;
            await User.updateOne({ _id: userId }, { $set: { billingProvider: "stripe", billingCustomerId: session.customer || "", billingSubscriptionId: session.subscription || "" } });
            if (session.subscription) await syncSubscription(await getStripe().subscriptions.retrieve(session.subscription));
        } else if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
            await syncSubscription(event.data.object);
        } else if (event.type === "invoice.payment_failed") {
            const invoice = event.data.object;
            await User.updateOne({ billingCustomerId: invoice.customer }, { $set: { subscriptionStatus: "past_due", plan: "free" } });
        } else if (event.type === "invoice.payment_succeeded") {
            const invoice = event.data.object;
            if (invoice.subscription) await syncSubscription(await getStripe().subscriptions.retrieve(invoice.subscription));
        } else if (["charge.dispute.created", "charge.refunded"].includes(event.type)) {
            const charge = event.data.object;
            if (charge.customer) await User.updateOne({ billingCustomerId: charge.customer }, { $set: { subscriptionStatus: "past_due", plan: "free" } });
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
