import { getStripe } from "../config/stripe.js";

const cached = new Map();
const CACHE_MS = 5 * 60 * 1000;

const priceIdFor = (product, plan) => {
    if (product === "hiring") {
        if (plan === "starter") return process.env.STRIPE_HIRING_STARTER_PRICE_ID;
        if (plan === "growth") return process.env.STRIPE_HIRING_GROWTH_PRICE_ID;
        if (plan === "enterprise") return process.env.STRIPE_HIRING_ENTERPRISE_PRICE_ID;
        return null;
    }
    if (plan === "scale") return process.env.STRIPE_SCALE_PRICE_ID;
    if (plan === "pro") return process.env.STRIPE_PRO_PRICE_ID;
    return null;
};

export const clearBillingCatalogCache = () => { cached.clear(); };

export async function getProductPlanPrice(product, plan, stripe = getStripe()) {
    const priceId = priceIdFor(product, plan);
    if (!priceId) return null;
    const cacheKey = `${product}:${plan}`;
    const entry = cached.get(cacheKey);
    if (entry && Date.now() - entry.loadedAt < CACHE_MS) return entry.value;
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active || price.type !== "recurring" || !price.recurring || !Number.isInteger(price.unit_amount)) {
        throw Object.assign(new Error(`Configured ${product} ${plan} price must be an active fixed recurring price`), { statusCode: 503 });
    }
    const value = { id: price.id, unitAmount: price.unit_amount, currency: price.currency, interval: price.recurring.interval, intervalCount: price.recurring.interval_count || 1 };
    cached.set(cacheKey, { loadedAt: Date.now(), value });
    return value;
}

export const getPlanPrice = (plan, stripe = getStripe()) => getProductPlanPrice("practice", plan, stripe);
export const getHiringPlanPrice = (plan, stripe = getStripe()) => getProductPlanPrice("hiring", plan, stripe);
export const getProPrice = (stripe = getStripe()) => getPlanPrice("pro", stripe);
export const getScalePrice = (stripe = getStripe()) => getPlanPrice("scale", stripe);
