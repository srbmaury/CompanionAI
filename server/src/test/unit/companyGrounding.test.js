import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCompanyGrounding } from "../../services/companyGrounding.js";

describe("company interview grounding", () => {
    const originalFetch = global.fetch;
    beforeEach(() => {
        process.env.NODE_ENV = "test";
        process.env.TEST_ENABLE_COMPANY_GROUNDING = "true";
        process.env.TAVILY_API_KEY = "test-key";
    });
    afterEach(() => {
        global.fetch = originalFetch;
        delete process.env.TEST_ENABLE_COMPANY_GROUNDING;
    });

    it("retains safe sources and extracts reported questions", async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ results: [{ title: "Acme interview experience", url: "https://example.com/acme", content: "How would you design a reliable queue? Explain database indexing tradeoffs." }] }),
        });
        const result = await getCompanyGrounding("Acme-grounding-test", "Backend Engineer");
        expect(result.status).toBe("grounded");
        expect(result.sources).toHaveLength(1);
        expect(result.reportedQuestions).toContain("How would you design a reliable queue?");
        expect(global.fetch).toHaveBeenCalledWith("https://api.tavily.com/search", expect.objectContaining({ method: "POST" }));
    });

    it("falls back transparently when grounding is unavailable", async () => {
        delete process.env.TAVILY_API_KEY;
        const result = await getCompanyGrounding("No-source-company", "Engineer");
        expect(result).toMatchObject({ status: "simulation", sources: [], reportedQuestions: [] });
    });
});
