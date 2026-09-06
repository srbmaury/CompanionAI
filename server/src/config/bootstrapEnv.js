import dotenv from "dotenv";

dotenv.config();

const CURRENT_STRIPE_PRICE_KEYS = [
    "STRIPE_PRACTICE_PRO_PRICE_ID",
    "STRIPE_HIRING_PILOT_PRICE_ID",
    "STRIPE_HIRING_STARTER_PRICE_ID",
    "STRIPE_HIRING_GROWTH_PRICE_ID",
];

export const normalizeEnvironment = (env = process.env) => {
    if (env.NODE_ENV === "production" && !env.COOKIE_SAMESITE) {
        env.COOKIE_SAMESITE = "none";
    }

    // app.js historically exposed a Stripe readiness gauge through the old
    // STRIPE_PRO_PRICE_ID name. Keep that gauge accurate while the billing
    // product uses separate Practice and Hiring price IDs.
    if (!env.STRIPE_PRO_PRICE_ID && CURRENT_STRIPE_PRICE_KEYS.every((key) => Boolean(env[key]))) {
        env.STRIPE_PRO_PRICE_ID = env.STRIPE_PRACTICE_PRO_PRICE_ID;
    }

    return env;
};

normalizeEnvironment();
