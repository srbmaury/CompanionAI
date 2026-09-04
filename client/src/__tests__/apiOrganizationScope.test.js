import { describe, expect, it } from "vitest";
import { shouldAttachOrganization } from "../api/axios";

describe("Hiring organization request scope", () => {
    it("attaches organization context only to authenticated Hiring APIs", () => {
        expect(shouldAttachOrganization("/assessments")).toBe(true);
        expect(shouldAttachOrganization("/assessments/overview")).toBe(true);
        expect(shouldAttachOrganization("/assessments/123/preview")).toBe(true);
        expect(shouldAttachOrganization("/assessments/questions/generate")).toBe(true);
        expect(shouldAttachOrganization("/billing/hiring/entitlements")).toBe(true);
        expect(shouldAttachOrganization("/sso/settings")).toBe(true);
        expect(shouldAttachOrganization("https://api.example.com/api/assessments/123")).toBe(true);
    });

    it("does not leak organization context into candidate, Practice, account, admin, or public SSO APIs", () => {
        expect(shouldAttachOrganization("/assessments/public/token")).toBe(false);
        expect(shouldAttachOrganization("/assessments/public/token/start")).toBe(false);
        expect(shouldAttachOrganization("/billing/practice/entitlements")).toBe(false);
        expect(shouldAttachOrganization("/interviews")).toBe(false);
        expect(shouldAttachOrganization("/resumes")).toBe(false);
        expect(shouldAttachOrganization("/recommendations")).toBe(false);
        expect(shouldAttachOrganization("/auth/profile")).toBe(false);
        expect(shouldAttachOrganization("/admin/feedback")).toBe(false);
        expect(shouldAttachOrganization("/organizations")).toBe(false);
        expect(shouldAttachOrganization("/sso/discover")).toBe(false);
        expect(shouldAttachOrganization("/sso/start")).toBe(false);
        expect(shouldAttachOrganization("/sso/exchange")).toBe(false);
        expect(shouldAttachOrganization("/sso/callback")).toBe(false);
    });
});
