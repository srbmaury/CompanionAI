import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PricingPage from "../pages/PricingPage";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../api/axios", () => ({ default: { get, post: vi.fn() } }));
vi.mock("../utils/analytics", () => ({ trackEvent: vi.fn() }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("pricing plans", () => {
    it("shows Free, Pro, and the high-capacity Scale plan from server limits", async () => {
        get.mockResolvedValue({ data: {
            plan: "free",
            limits: { interviews: 3, resumeReviews: 3, assessments: 2 },
            planLimits: {
                free: { interviews: 3, resumeReviews: 3, assessments: 2 },
                pro: { interviews: 100, resumeReviews: 100, assessments: 50 },
                scale: { interviews: 1000, resumeReviews: 1000, assessments: 500 },
            },
            prices: { pro: { unitAmount: 100, currency: "usd", interval: "month", intervalCount: 1 }, scale: { unitAmount: 500, currency: "usd", interval: "month", intervalCount: 1 } },
            billingAvailable: { pro: true, scale: true },
        } });
        render(<MemoryRouter><PricingPage /></MemoryRouter>);
        expect(await screen.findByRole("heading", { name: "Scale" })).toBeTruthy();
        expect(screen.getByText("1000 practice interviews each month")).toBeTruthy();
        expect(screen.getByText("1000 resume reviews each month")).toBeTruthy();
        expect(screen.getByText("500 candidate assessments each month")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Choose Scale" })).toBeTruthy();
    });
});
