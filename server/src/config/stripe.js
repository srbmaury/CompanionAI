import Stripe from "stripe";

let client;
export const getStripe = () => {
    if (!process.env.STRIPE_SECRET_KEY) throw Object.assign(new Error("Billing is not configured"), { statusCode: 503 });
    if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 15000 });
    return client;
};
