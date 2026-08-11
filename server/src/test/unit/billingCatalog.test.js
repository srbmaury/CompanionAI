import { afterEach, describe, expect, it, vi } from "vitest";
import { clearBillingCatalogCache, getProPrice, getScalePrice } from "../../services/billingCatalog.js";

describe("billing catalog", () => {
    afterEach(() => { clearBillingCatalogCache(); delete process.env.STRIPE_PRO_PRICE_ID; delete process.env.STRIPE_SCALE_PRICE_ID; });
    it("returns only the safe recurring-price fields and caches Stripe reads", async () => {
        process.env.STRIPE_PRO_PRICE_ID = "price_pro";
        const retrieve = vi.fn().mockResolvedValue({ id: "price_pro", active: true, type: "recurring", unit_amount: 100, currency: "usd", recurring: { interval: "month", interval_count: 1 }, product: "prod_secret_context" });
        const stripe = { prices: { retrieve } };
        await expect(getProPrice(stripe)).resolves.toEqual({ id: "price_pro", unitAmount: 100, currency: "usd", interval: "month", intervalCount: 1 });
        await getProPrice(stripe);
        expect(retrieve).toHaveBeenCalledTimes(1);
    });
    it("loads and caches Scale independently from Pro", async () => {
        process.env.STRIPE_PRO_PRICE_ID = "price_pro"; process.env.STRIPE_SCALE_PRICE_ID = "price_scale";
        const retrieve = vi.fn((id) => Promise.resolve({ id, active: true, type: "recurring", unit_amount: id === "price_scale" ? 5000 : 1000, currency: "usd", recurring: { interval: "month", interval_count: 1 } }));
        const stripe = { prices: { retrieve } };
        await expect(getScalePrice(stripe)).resolves.toMatchObject({ id: "price_scale", unitAmount: 5000 });
        await getScalePrice(stripe); await getProPrice(stripe);
        expect(retrieve).toHaveBeenCalledTimes(2);
    });
    it("rejects inactive or non-recurring prices", async () => {
        process.env.STRIPE_PRO_PRICE_ID = "price_bad";
        const stripe = { prices: { retrieve: vi.fn().mockResolvedValue({ id: "price_bad", active: false, type: "one_time", unit_amount: 100, currency: "usd" }) } };
        await expect(getProPrice(stripe)).rejects.toThrow(/active fixed recurring price/i);
    });
});
