import { describe, expect, it } from "vitest";
import { shouldShowGlobalBack } from "../utils/navigationHierarchy";

describe("global back-button hierarchy", () => {
    it.each([
        "/",
        "/login",
        "/register",
        "/verify-email",
        "/forgot-password",
        "/reset-password",
        "/privacy",
        "/terms",
        "/practice/dashboard",
        "/practice/resume-review",
        "/practice/progress",
        "/practice/company-insights",
        "/practice/profile",
        "/practice/pricing",
        "/practice/billing/success",
        "/admin/feedback",
        "/admin/audit",
        "/hire/team",
        "/assessment/public-share-token",
    ])("does not show Back on root page %s", (pathname) => {
        expect(shouldShowGlobalBack({ pathname, search: "" })).toBe(false);
    });

    it("treats Hiring sibling views as roots", () => {
        expect(shouldShowGlobalBack({ pathname: "/hire/assessments", search: "", hash: "" })).toBe(false);
        expect(shouldShowGlobalBack({ pathname: "/hire/assessments", search: "", hash: "#candidate-pipeline" })).toBe(false);
        expect(shouldShowGlobalBack({ pathname: "/hire/assessments", search: "", hash: "#assessment-list" })).toBe(false);
    });

    it.each([
        ["/hire/assessments", "?create=1"],
        ["/hire/assessments", "?create=1&edit=a1"],
        ["/hire/assessments/a1", ""],
        ["/hire/assessments/a1/preview", ""],
        ["/practice/new", ""],
        ["/practice/interviews/i1", ""],
        ["/practice/resume-reviews", ""],
        ["/practice/resume-match", ""],
        ["/practice/resumes", ""],
        ["/practice/saved-experiences", ""],
    ])("shows Back on nested page %s%s", (pathname, search) => {
        expect(shouldShowGlobalBack({ pathname, search })).toBe(true);
    });
});
