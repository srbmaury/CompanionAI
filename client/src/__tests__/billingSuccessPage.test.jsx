import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import api from "../api/axios";
import BillingSuccessPage from "../pages/BillingSuccessPage";

vi.mock("../api/axios", () => ({ default: { get: vi.fn() } }));

describe("BillingSuccessPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        const values = new Map();
        vi.stubGlobal("localStorage", {
            clear: () => values.clear(),
            getItem: (key) => values.get(key) ?? null,
            removeItem: (key) => values.delete(key),
            setItem: (key, value) => values.set(key, String(value)),
        });
    });
    afterEach(() => vi.unstubAllGlobals());

    it("recognizes a Scale checkout and returns recruiters to Hiring", async () => {
        localStorage.setItem("companionai:workspace", "hiring");
        api.get.mockResolvedValue({ data: { plan: "scale" } });

        render(<MemoryRouter><BillingSuccessPage /></MemoryRouter>);

        expect(await screen.findByText("Scale is active on your account.")).toBeTruthy();
        expect(screen.getByRole("link", { name: "Continue to Hiring" }).getAttribute("href")).toBe("/assessments");
    });
});
