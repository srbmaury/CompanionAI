import { describe, expect, it } from "vitest";
import { isProductNavItemActive } from "../components/ProductHeader";

const overview = { label: "Overview", path: "/hire/assessments" };
const candidates = { label: "Candidates", path: "/hire/assessments", hash: "#candidate-pipeline" };
const assessments = { label: "Assessments", path: "/hire/assessments", hash: "#assessment-list", matchPrefix: "/hire/assessments/" };

describe("Hire navbar active state", () => {
    it("highlights only Overview on the base Hire route", () => {
        const location = { pathname: "/hire/assessments", hash: "" };
        expect(isProductNavItemActive(location, overview)).toBe(true);
        expect(isProductNavItemActive(location, candidates)).toBe(false);
        expect(isProductNavItemActive(location, assessments)).toBe(false);
    });

    it("highlights only Candidates on the candidate pipeline hash", () => {
        const location = { pathname: "/hire/assessments", hash: "#candidate-pipeline" };
        expect(isProductNavItemActive(location, overview)).toBe(false);
        expect(isProductNavItemActive(location, candidates)).toBe(true);
        expect(isProductNavItemActive(location, assessments)).toBe(false);
    });

    it("highlights only Assessments on the assessment-list hash", () => {
        const location = { pathname: "/hire/assessments", hash: "#assessment-list" };
        expect(isProductNavItemActive(location, overview)).toBe(false);
        expect(isProductNavItemActive(location, candidates)).toBe(false);
        expect(isProductNavItemActive(location, assessments)).toBe(true);
    });

    it("keeps Assessments active while reviewing a specific assessment", () => {
        const location = { pathname: "/hire/assessments/a1", hash: "" };
        expect(isProductNavItemActive(location, overview)).toBe(false);
        expect(isProductNavItemActive(location, candidates)).toBe(false);
        expect(isProductNavItemActive(location, assessments)).toBe(true);
    });
});

describe("Practice navbar active state", () => {
    it("keeps Overview active while an interview is open", () => {
        const practiceOverview = { label: "Overview", path: "/practice/dashboard", matchPrefix: "/practice/interviews/" };
        expect(isProductNavItemActive({ pathname: "/practice/interviews/i1", hash: "" }, practiceOverview)).toBe(true);
    });
});
