import { describe, expect, it } from "vitest";
import {
    canonicalProductPath,
    productHomePath,
    productLoginPath,
    productRegisterPath,
    surfaceForPath,
    workspaceForSurface,
} from "../utils/productRoutes";

describe("productRoutes", () => {
    it("recognizes canonical and legacy practice routes", () => {
        expect(surfaceForPath("/practice/dashboard")).toBe("practice");
        expect(surfaceForPath("/dashboard")).toBe("practice");
        expect(surfaceForPath("/interviews/abc")).toBe("practice");
    });

    it("recognizes canonical and legacy hiring routes", () => {
        expect(surfaceForPath("/hire/assessments")).toBe("hiring");
        expect(surfaceForPath("/assessments/abc")).toBe("hiring");
        expect(surfaceForPath("/hiring/team")).toBe("hiring");
    });

    it("keeps public candidate assessment links neutral", () => {
        expect(surfaceForPath("/assessment/token")).toBeNull();
        expect(canonicalProductPath("/assessment/token")).toBe("/assessment/token");
    });

    it("canonicalizes legacy product URLs", () => {
        expect(canonicalProductPath("/dashboard")).toBe("/practice/dashboard");
        expect(canonicalProductPath("/create-interview")).toBe("/practice/new");
        expect(canonicalProductPath("/interviews/abc")).toBe("/practice/interviews/abc");
        expect(canonicalProductPath("/assessments/abc")).toBe("/hire/assessments/abc");
        expect(canonicalProductPath("/hiring/team")).toBe("/hire/team");
    });

    it("does not rewrite canonical routes", () => {
        expect(canonicalProductPath("/practice/progress")).toBe("/practice/progress");
        expect(canonicalProductPath("/hire/team")).toBe("/hire/team");
    });

    it("returns product-specific auth and home destinations", () => {
        expect(productHomePath("practice")).toBe("/practice/dashboard");
        expect(productHomePath("hiring")).toBe("/hire/assessments");
        expect(productLoginPath("practice")).toBe("/practice/login");
        expect(productLoginPath("hiring")).toBe("/hire/login");
        expect(productRegisterPath("practice")).toBe("/practice/register");
        expect(productRegisterPath("hiring")).toBe("/hire/register");
        expect(workspaceForSurface("practice")).toBe("practice");
        expect(workspaceForSurface("hiring")).toBe("hiring");
    });
});
