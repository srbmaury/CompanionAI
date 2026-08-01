import { getStripe } from "../config/stripe.js";

let cached = null;
const CACHE_MS = 5 * 60 * 1000;

export const clearBillingCatalogCache = () => { cached = null; };
export async function getProPrice(stripe = getStripe()) {
    if (!process.env.STRIPE_PRO_PRICE_ID) return null;
    if (cached && Date.now() - cached.loadedAt < CACHE_MS) return cached.value;
    const price = await stripe.prices.retrieve(process.env.STRIPE_PRO_PRICE_ID);
    if (!price.active || price.type !== "recurring" || !price.recurring || !Number.isInteger(price.unit_amount)) {
        throw Object.assign(new Error("Configured Pro price must be an active fixed recurring price"), { statusCode: 503 });
    }
    const value = { id: price.id, unitAmount: price.unit_amount, currency: price.currency, interval: price.recurring.interval, intervalCount: price.recurring.interval_count || 1 };
    cached = { loadedAt: Date.now(), value };
    return value;
}
