import { getStripe } from "../config/stripe.js";

const cached = new Map();
const CACHE_MS = 5 * 60 * 1000;

const priceIds = () => ({
    practice: {
        pro: process.env.STRIPE_PRACTICE_PRO_PRICE_ID || process.env.STRIPE_PRO_PRICE_ID || "",
    },
    hiring: {
        pilot: process.env.STRIPE_HIRING_PILOT_PRICE_ID || "",
        starter: process.env.STRIPE_HIRING_STARTER_PRICE_ID || "",
        growth: process.env.STRIPE_HIRING_GROWTH_PRICE_ID || process.env.STRIPE_SCALE_PRICE_ID || "",
    },
});

export const clearBillingCatalogCache = () => { cached.clear(); };
export const getConfiguredPriceId = (product, plan) => priceIds()?.[product]?.[plan] || "";

const cachedPrice = async (cacheKey, priceId, stripe, validate, map) => {
    if (!priceId) return null;
    const entry = cached.get(cacheKey);
    if (entry && Date.now() - entry.loadedAt < CACHE_MS) return entry.value;
    const price = await stripe.prices.retrieve(priceId);
    validate(price);
    const value = map(price);
    cached.set(cacheKey, { loadedAt: Date.now(), value });
    return value;
};

export async function getPlanPrice(product, plan, stripe = getStripe()) {
    const priceId = getConfiguredPriceId(product, plan);
    return cachedPrice(
        `${product}:${plan}:recurring`,
        priceId,
        stripe,
        (price) => {
            if (!price.active || price.type !== "recurring" || !price.recurring || !Number.isInteger(price.unit_amount)) {
                throw Object.assign(new Error(`Configured ${product} ${plan} price must be an active fixed recurring price`), { statusCode: 503 });
            }
        },
        (price) => ({
            id: price.id,
            unitAmount: price.unit_amount,
            currency: price.currency,
            interval: price.recurring.interval,
            intervalCount: price.recurring.interval_count || 1,
        }),
    );
}

export async function getOneTimePrice(product, plan, stripe = getStripe()) {
    const priceId = getConfiguredPriceId(product, plan);
    return cachedPrice(
        `${product}:${plan}:one_time`,
        priceId,
        stripe,
        (price) => {
            if (!price.active || price.type !== "one_time" || price.recurring || !Number.isInteger(price.unit_amount)) {
                throw Object.assign(new Error(`Configured ${product} ${plan} price must be an active fixed one-time price`), { statusCode: 503 });
            }
        },
        (price) => ({
            id: price.id,
            unitAmount: price.unit_amount,
            currency: price.currency,
            type: "one_time",
        }),
    );
}
