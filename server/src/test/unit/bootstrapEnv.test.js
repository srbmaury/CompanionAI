import { describe, expect, it } from "vitest";
import { normalizeEnvironment } from "../../config/bootstrapEnv.js";

describe("runtime environment normalization", () => {
    it("defaults production refresh cookies to cross-site compatible SameSite=None", () => {
        const env = { NODE_ENV: "production" };
        normalizeEnvironment(env);
        expect(env.COOKIE_SAMESITE).toBe("none");
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
