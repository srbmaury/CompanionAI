import { getStripe } from "../config/stripe.js";

const cached = new Map();
const CACHE_MS = 5 * 60 * 1000;

export const clearBillingCatalogCache = () => { cached.clear(); };
export async function getPlanPrice(plan, stripe = getStripe()) {
    const priceId = plan === "scale" ? process.env.STRIPE_SCALE_PRICE_ID : process.env.STRIPE_PRO_PRICE_ID;
    if (!priceId) return null;
    const entry = cached.get(plan);
    if (entry && Date.now() - entry.loadedAt < CACHE_MS) return entry.value;
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active || price.type !== "recurring" || !price.recurring || !Number.isInteger(price.unit_amount)) {
        throw Object.assign(new Error(`Configured ${plan} price must be an active fixed recurring price`), { statusCode: 503 });
    }
    const value = { id: price.id, unitAmount: price.unit_amount, currency: price.currency, interval: price.recurring.interval, intervalCount: price.recurring.interval_count || 1 };
    cached.set(plan, { loadedAt: Date.now(), value });
    return value;
}
export const getProPrice = (stripe = getStripe()) => getPlanPrice("pro", stripe);
export const getScalePrice = (stripe = getStripe()) => getPlanPrice("scale", stripe);
