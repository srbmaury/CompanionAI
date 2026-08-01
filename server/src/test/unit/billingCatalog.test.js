import { afterEach, describe, expect, it, vi } from "vitest";
import { clearBillingCatalogCache, getProPrice } from "../../services/billingCatalog.js";

describe("billing catalog", () => {
    afterEach(() => { clearBillingCatalogCache(); delete process.env.STRIPE_PRO_PRICE_ID; });
    it("returns only the safe recurring-price fields and caches Stripe reads", async () => {
        process.env.STRIPE_PRO_PRICE_ID = "price_pro";
        const retrieve = vi.fn().mockResolvedValue({ id: "price_pro", active: true, type: "recurring", unit_amount: 100, currency: "usd", recurring: { interval: "month", interval_count: 1 }, product: "prod_secret_context" });
        const stripe = { prices: { retrieve } };
        await expect(getProPrice(stripe)).resolves.toEqual({ id: "price_pro", unitAmount: 100, currency: "usd", interval: "month", intervalCount: 1 });
        await getProPrice(stripe);
        expect(retrieve).toHaveBeenCalledTimes(1);
    });
    it("rejects inactive or non-recurring prices", async () => {
        process.env.STRIPE_PRO_PRICE_ID = "price_bad";
        const stripe = { prices: { retrieve: vi.fn().mockResolvedValue({ id: "price_bad", active: false, type: "one_time", unit_amount: 100, currency: "usd" }) } };
        await expect(getProPrice(stripe)).rejects.toThrow(/active fixed recurring price/i);
    });
});
