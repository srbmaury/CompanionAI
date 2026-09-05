import { describe, expect, it } from "vitest";
import { isProductNavItemActive } from "../components/ProductHeader";

const overview = { label: "Overview", path: "/hire/assessments" };
const candidates = { label: "Candidates", path: "/hire/assessments", hash: "#candidate-pipeline" };
const assessments = { label: "Assessments", path: "/hire/assessments", hash: "#assessment-list" };

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
});
