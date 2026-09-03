import { beforeEach, describe, expect, it } from "vitest";
import {
    adoptGuestWorkspacePreference,
    clearGuestWorkspacePreference,
    clearWorkspacePreference,
    getWorkspaceHome,
    getWorkspacePreference,
    setWorkspacePreference,
    workspaceKeyForUser,
} from "../utils/workspacePreference";

describe("workspacePreference", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("keeps workspace preferences isolated by user", () => {
        setWorkspacePreference("hiring", "user-a");
        setWorkspacePreference("practice", "user-b");

        expect(getWorkspacePreference("user-a")).toBe("hiring");
        expect(getWorkspacePreference("user-b")).toBe("practice");
        expect(localStorage.getItem(workspaceKeyForUser("user-a"))).toBe("hiring");
        expect(localStorage.getItem(workspaceKeyForUser("user-b"))).toBe("practice");
    });

    it("adopts guest intent once for the user who signs in", () => {
        setWorkspacePreference("hiring");

        expect(adoptGuestWorkspacePreference("user-a")).toBe("hiring");
        expect(getWorkspacePreference("user-a")).toBe("hiring");
        expect(getWorkspacePreference()).toBeNull();
        expect(getWorkspacePreference("user-b")).toBeNull();
    });

    it("does not overwrite an existing user preference when there is no guest intent", () => {
        setWorkspacePreference("practice", "user-a");
        clearGuestWorkspacePreference();

        expect(adoptGuestWorkspacePreference("user-a")).toBe("practice");
        expect(getWorkspacePreference("user-a")).toBe("practice");
    });

    it("clears only the requested account preference", () => {
        setWorkspacePreference("hiring", "user-a");
        setWorkspacePreference("practice", "user-b");

        clearWorkspacePreference("user-a");

        expect(getWorkspacePreference("user-a")).toBeNull();
        expect(getWorkspacePreference("user-b")).toBe("practice");
    });

    it("maps workspaces to their home routes", () => {
        expect(getWorkspaceHome("hiring")).toBe("/assessments");
        expect(getWorkspaceHome("practice")).toBe("/dashboard");
        expect(getWorkspaceHome(null)).toBe("/dashboard");
    });
});
