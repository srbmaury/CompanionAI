import { expect, test } from "@playwright/test";

const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const mockSignedIn = async (page) => {
    await page.route("**/api/auth/refresh", (route) => json(route, { token: "test-access-token" }));
    await page.route("**/api/auth/profile", (route) => json(route, {
        _id: "user-1",
        name: "Mobile User",
        email: "mobile@example.com",
        role: "user",
        practicePlan: "free",
    }));
    await page.route("**/api/organizations**", (route) => json(route, {
        organizations: [{ _id: "org-1", name: "Acme Hiring", role: "owner", memberCount: 1 }],
    }));
    await page.route("**/api/events", (route) => json(route, { recorded: true }, 201));
};

const openNavigation = async (page) => {
    await page.getByRole("button", { name: "Open navigation" }).click();
};

const closeMenu = async (page) => {
    await page.keyboard.press("Escape");
};

const visibleMenuItem = (page, name) => page.getByRole("menuitem", { name }).filter({ visible: true });

test("mobile navigation keeps workspace, organization, and account actions accessible", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "Mobile navigation regression test");
    await mockSignedIn(page);

    await page.goto("/hire");
    await openNavigation(page);
    await expect(visibleMenuItem(page, "Practice")).toBeVisible();
    await expect(visibleMenuItem(page, "Hire")).toBeVisible();
    await expect(visibleMenuItem(page, /Acme Hiring/i)).toBeVisible();
    await expect(visibleMenuItem(page, "Team & billing")).toBeVisible();
    await expect(page.getByRole("button", { name: "Account menu" })).toHaveCount(0);
    await closeMenu(page);

    await page.goto("/practice");
    await openNavigation(page);
    await expect(visibleMenuItem(page, "Practice")).toBeVisible();
    await expect(visibleMenuItem(page, "Hire")).toBeVisible();
    await expect(visibleMenuItem(page, "Profile")).toBeVisible();
    await expect(visibleMenuItem(page, "Review resume")).toBeVisible();
    await expect(visibleMenuItem(page, "Match to job")).toBeVisible();
    await expect(page.getByRole("button", { name: "Account menu" })).toHaveCount(0);
    await closeMenu(page);

    await page.goto("/privacy");
    await openNavigation(page);
    await expect(visibleMenuItem(page, "Practice")).toBeVisible();
    await expect(visibleMenuItem(page, "Hire")).toBeVisible();
    await expect(visibleMenuItem(page, "Docs")).toBeVisible();
    await expect(visibleMenuItem(page, "Profile & settings")).toBeVisible();
    await expect(page.getByText(/billing/i)).toHaveCount(0);
});
