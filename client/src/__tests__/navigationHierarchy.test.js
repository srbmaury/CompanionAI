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
        "/dashboard",
        "/resume-review",
        "/progress",
        "/experiences",
        "/profile",
        "/pricing",
        "/billing/success",
        "/admin/feedback",
        "/admin/audit",
        "/hiring/team",
        "/assessment/public-share-token",
    ])("does not show Back on root page %s", (pathname) => {
        expect(shouldShowGlobalBack({ pathname, search: "" })).toBe(false);
    });

    it("treats Hiring sibling views as roots", () => {
        expect(shouldShowGlobalBack({ pathname: "/assessments", search: "", hash: "" })).toBe(false);
        expect(shouldShowGlobalBack({ pathname: "/assessments", search: "", hash: "#candidate-pipeline" })).toBe(false);
        expect(shouldShowGlobalBack({ pathname: "/assessments", search: "", hash: "#assessment-list" })).toBe(false);
    });

    it.each([
        ["/assessments", "?create=1"],
        ["/assessments", "?create=1&edit=a1"],
        ["/assessments/a1", ""],
        ["/assessments/a1/preview", ""],
        ["/create-interview", ""],
        ["/interviews/i1", ""],
        ["/resume-reviews", ""],
        ["/resume-match", ""],
        ["/resumes", ""],
        ["/saved-experiences", ""],
    ])("shows Back on nested page %s%s", (pathname, search) => {
        expect(shouldShowGlobalBack({ pathname, search })).toBe(true);
    });
});
