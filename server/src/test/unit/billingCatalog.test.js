import { afterEach, describe, expect, it, vi } from "vitest";
import { clearBillingCatalogCache, getConfiguredPriceId, getOneTimePrice, getPlanPrice } from "../../services/billingCatalog.js";

const clearPriceEnv = () => {
    delete process.env.STRIPE_PRACTICE_PRO_PRICE_ID;
    delete process.env.STRIPE_HIRING_PILOT_PRICE_ID;
    delete process.env.STRIPE_HIRING_STARTER_PRICE_ID;
    delete process.env.STRIPE_HIRING_GROWTH_PRICE_ID;
    delete process.env.STRIPE_PRO_PRICE_ID;
    delete process.env.STRIPE_SCALE_PRICE_ID;
};

describe("billing catalog", () => {
    afterEach(() => {
        clearBillingCatalogCache();
        clearPriceEnv();
    });

    it("returns safe Practice Pro price fields and caches Stripe reads", async () => {
        process.env.STRIPE_PRACTICE_PRO_PRICE_ID = "price_practice_pro";
        const retrieve = vi.fn().mockResolvedValue({
            id: "price_practice_pro",
            active: true,
            type: "recurring",
            unit_amount: 1000,
            currency: "usd",
            recurring: { interval: "month", interval_count: 1 },
            product: "prod_private_context",
        });
        const stripe = { prices: { retrieve } };

        await expect(getPlanPrice("practice", "pro", stripe)).resolves.toEqual({
            id: "price_practice_pro",
            unitAmount: 1000,
            currency: "usd",
            interval: "month",
            intervalCount: 1,
        });
        await getPlanPrice("practice", "pro", stripe);
        expect(retrieve).toHaveBeenCalledTimes(1);
    });

    it("returns safe one-time fields for the Hiring pilot", async () => {
        process.env.STRIPE_HIRING_PILOT_PRICE_ID = "price_pilot";
        const retrieve = vi.fn().mockResolvedValue({
            id: "price_pilot",
            active: true,
            type: "one_time",
            unit_amount: 299900,
            currency: "inr",
            recurring: null,
        });
        const stripe = { prices: { retrieve } };
        await expect(getOneTimePrice("hiring", "pilot", stripe)).resolves.toEqual({
            id: "price_pilot",
            unitAmount: 299900,
            currency: "inr",
            type: "one_time",
        });
    });

    it("caches Hiring Starter and Growth independently from Practice", async () => {
        process.env.STRIPE_PRACTICE_PRO_PRICE_ID = "price_practice";
        process.env.STRIPE_HIRING_STARTER_PRICE_ID = "price_starter";
        process.env.STRIPE_HIRING_GROWTH_PRICE_ID = "price_growth";
        const retrieve = vi.fn((id) => Promise.resolve({
            id,
            active: true,
            type: "recurring",
            unit_amount: id === "price_growth" ? 5000 : id === "price_starter" ? 2500 : 1000,
            currency: "usd",
            recurring: { interval: "month", interval_count: 1 },
        }));
        const stripe = { prices: { retrieve } };

        await expect(getPlanPrice("hiring", "growth", stripe)).resolves.toMatchObject({ id: "price_growth", unitAmount: 5000 });
        await getPlanPrice("hiring", "growth", stripe);
        await getPlanPrice("hiring", "starter", stripe);
        await getPlanPrice("practice", "pro", stripe);
        expect(retrieve).toHaveBeenCalledTimes(3);
    });

    it("rejects inactive or wrong-type configured prices", async () => {
        process.env.STRIPE_HIRING_STARTER_PRICE_ID = "price_bad";
        process.env.STRIPE_HIRING_PILOT_PRICE_ID = "price_bad_pilot";
        const stripe = {
            prices: {
                retrieve: vi.fn((id) => Promise.resolve(id === "price_bad" ? {
                    id,
                    active: false,
                    type: "one_time",
                    unit_amount: 100,
                    currency: "usd",
                } : {
                    id,
                    active: true,
                    type: "recurring",
                    unit_amount: 100,
                    currency: "usd",
                    recurring: { interval: "month", interval_count: 1 },
                })),
            },
        };
        await expect(getPlanPrice("hiring", "starter", stripe)).rejects.toThrow(/active fixed recurring price/i);
        await expect(getOneTimePrice("hiring", "pilot", stripe)).rejects.toThrow(/active fixed one-time price/i);
    });

    it("keeps Practice and Hiring price configuration separate", () => {
        process.env.STRIPE_PRACTICE_PRO_PRICE_ID = "price_practice";
        process.env.STRIPE_HIRING_PILOT_PRICE_ID = "price_pilot";
        process.env.STRIPE_HIRING_STARTER_PRICE_ID = "price_starter";
        process.env.STRIPE_HIRING_GROWTH_PRICE_ID = "price_growth";
        expect(getConfiguredPriceId("practice", "pro")).toBe("price_practice");
        expect(getConfiguredPriceId("hiring", "pilot")).toBe("price_pilot");
        expect(getConfiguredPriceId("hiring", "starter")).toBe("price_starter");
        expect(getConfiguredPriceId("hiring", "growth")).toBe("price_growth");
    });
});
