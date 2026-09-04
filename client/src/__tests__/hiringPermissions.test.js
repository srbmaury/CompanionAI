import { describe, expect, it } from "vitest";
import { assignableHiringRolesFor, canManageHiringMember, hiringHomeForRole, hiringPermissionsFor } from "../utils/hiringPermissions";

describe("Hiring role permissions", () => {
    it("gives owners and admins organization administration and Hiring billing controls", () => {
        for (const role of ["owner", "admin"]) {
            expect(hiringPermissionsFor(role)).toMatchObject({
                canViewOverview: true,
                canViewCandidatePipeline: true,
                canViewAssessments: true,
                canManageAssessments: true,
                canReviewCandidates: true,
                canManageOrganization: true,
                canManageHiringBilling: true,
                canExportCandidateData: true,
            });
        }
    });

    it("lets recruiters manage assessments without exposing organization administration", () => {
        expect(hiringPermissionsFor("recruiter")).toMatchObject({
            canViewOverview: true,
            canViewCandidatePipeline: true,
            canViewAssessments: true,
            canManageAssessments: true,
            canReviewCandidates: true,
            canManageOrganization: false,
            canManageHiringBilling: false,
            canExportCandidateData: true,
        });
    });

    it("keeps hiring managers focused on reports and candidate review", () => {
        expect(hiringPermissionsFor("hiring_manager")).toMatchObject({
            canViewOverview: true,
            canViewCandidatePipeline: true,
            canViewAssessments: true,
            canManageAssessments: false,
            canReviewCandidates: true,
            canManageOrganization: false,
            canManageHiringBilling: false,
            canExportCandidateData: true,
        });
    });

    it("keeps reviewers focused on the candidate pipeline and review evidence", () => {
        expect(hiringPermissionsFor("reviewer")).toMatchObject({
            canViewOverview: false,
            canViewCandidatePipeline: true,
            canViewAssessments: false,
            canManageAssessments: false,
            canReviewCandidates: true,
            canManageOrganization: false,
            canManageHiringBilling: false,
            canExportCandidateData: false,
        });
        expect(hiringHomeForRole("reviewer")).toBe("/hire/assessments#candidate-pipeline");
    });

    it("defaults unknown roles to least privilege", () => {
        expect(hiringPermissionsFor(null)).toMatchObject({
            canViewOverview: false,
            canViewCandidatePipeline: false,
            canViewAssessments: false,
            canManageAssessments: false,
            canReviewCandidates: false,
            canManageOrganization: false,
            canManageHiringBilling: false,
            canExportCandidateData: false,
        });
    });

    it("prevents admins from administering peer admins while owners can", () => {
        expect(assignableHiringRolesFor("owner")).toContain("admin");
        expect(assignableHiringRolesFor("admin")).not.toContain("admin");
        expect(canManageHiringMember("admin", "admin")).toBe(false);
        expect(canManageHiringMember("admin", "recruiter")).toBe(true);
        expect(canManageHiringMember("owner", "admin")).toBe(true);
        expect(canManageHiringMember("owner", "owner")).toBe(false);
    });
});
