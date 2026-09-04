import { getStripe } from "../config/stripe.js";

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
