import { describe, expect, it } from "vitest";
import { seoForPath } from "../components/PublicRouteSeo.jsx";
import { isIndexablePath } from "../components/SearchIndexPolicy.jsx";

describe("public route SEO", () => {
    it("uses canonical product routes rather than legacy redirect routes", () => {
        expect(seoForPath("/practice")?.canonicalPath).toBe("/practice");
        expect(seoForPath("/hire")?.canonicalPath).toBe("/hire");
        expect(isIndexablePath("/practice")).toBe(true);
        expect(isIndexablePath("/hire")).toBe(true);
        expect(isIndexablePath("/interview-practice")).toBe(false);
        expect(isIndexablePath("/technical-hiring")).toBe(false);
    });

    it("keeps candidate and authenticated application routes out of public SEO metadata", () => {
        expect(seoForPath("/assessment/private-token")).toBeNull();
        expect(seoForPath("/practice/dashboard")).toBeNull();
        expect(seoForPath("/hire/assessments")).toBeNull();
    });

    it("provides dedicated metadata for high-value documentation pages", () => {
        expect(seoForPath("/docs/technical-hiring/system-design-interviews")?.title).toMatch(/System Design Interviews/);
        expect(seoForPath("/docs/security/human-review-and-integrity-signals")?.description).toMatch(/privacy/i);
    });
});
