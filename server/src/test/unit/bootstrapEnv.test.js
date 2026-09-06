import { describe, expect, it } from "vitest";
import { normalizeEnvironment } from "../../config/bootstrapEnv.js";

describe("runtime environment normalization", () => {
    it("defaults production refresh cookies to cross-site compatible SameSite=None", () => {
        const env = { NODE_ENV: "production" };
        normalizeEnvironment(env);
        expect(env.COOKIE_SAMESITE).toBe("none");
    });

    it("constructs REDIS_URL from Render Redis host and port when needed", () => {
        const env = { REDIS_HOST: "red-render-test", REDIS_PORT: "6380" };
        normalizeEnvironment(env);
        expect(env.REDIS_URL).toBe("redis://red-render-test:6380");

        const defaultPort = { REDIS_HOST: "red-render-default" };
        normalizeEnvironment(defaultPort);
        expect(defaultPort.REDIS_URL).toBe("redis://red-render-default:6379");

        const explicitUrl = {
            REDIS_URL: "rediss://example.invalid:6379",
            REDIS_HOST: "red-render-ignored",
        };
        normalizeEnvironment(explicitUrl);
        expect(explicitUrl.REDIS_URL).toBe("rediss://example.invalid:6379");
    });

    it("bridges the legacy Stripe readiness flag only when the current catalog is complete", () => {
        const complete = {
            STRIPE_PRACTICE_PRO_PRICE_ID: "price_practice",
            STRIPE_HIRING_PILOT_PRICE_ID: "price_pilot",
            STRIPE_HIRING_STARTER_PRICE_ID: "price_starter",
            STRIPE_HIRING_GROWTH_PRICE_ID: "price_growth",
        };
        normalizeEnvironment(complete);
        expect(complete.STRIPE_PRO_PRICE_ID).toBe("price_practice");

        const incomplete = { STRIPE_PRACTICE_PRO_PRICE_ID: "price_practice" };
        normalizeEnvironment(incomplete);
        expect(incomplete.STRIPE_PRO_PRICE_ID).toBeUndefined();
    });
});
