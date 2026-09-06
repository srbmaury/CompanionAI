import { expect, test } from "@playwright/test";

const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const mockGuest = async (page) => {
    await page.route("**/api/auth/refresh", (route) => json(route, { message: "unauthorized" }, 401));
    await page.route("**/api/events", (route) => json(route, { recorded: true }, 201));
};

const mockSignedIn = async (page) => {
    await page.route("**/api/auth/refresh", (route) => json(route, { token: "test-access-token" }));
    await page.route("**/api/auth/profile", (route) => json(route, {
        _id: "user-1",
        name: "Nav User",
        email: "nav@example.com",
        role: "user",
        practicePlan: "free",
    }));
    await page.route("**/api/organizations**", (route) => json(route, {
        organizations: [{ _id: "org-1", name: "Acme Hiring", role: "owner", memberCount: 1 }],
    }));
    await page.route("**/api/events", (route) => json(route, { recorded: true }, 201));
};

test("guest product auth screens use a minimal header", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop navigation regression test");
    await mockGuest(page);

    await page.goto("/practice/login");
    const practiceHeader = page.locator("header");
    await expect(practiceHeader.getByRole("link", { name: "Back to Practice" })).toBeVisible();
    await expect(practiceHeader.getByRole("link", { name: "For hiring teams" })).toHaveCount(0);
    await expect(practiceHeader.getByRole("link", { name: "Start practicing" })).toHaveCount(0);

    await page.goto("/hire/register");
    const hireHeader = page.locator("header");
    await expect(hireHeader.getByRole("link", { name: "Back to Hire" })).toBeVisible();
    await expect(hireHeader.getByRole("link", { name: "For candidates" })).toHaveCount(0);
    await expect(hireHeader.getByRole("link", { name: "Start hiring" })).toHaveCount(0);
});

test("global guest header exposes product discovery and a single primary CTA", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop navigation regression test");
    await mockGuest(page);

    await page.goto("/privacy");
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "Practice" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Hire" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Docs" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Get started" })).toBeVisible();
});

test("signed-in practice groups resume destinations and exposes workspace switching", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop navigation regression test");
    await mockSignedIn(page);

    await page.goto("/practice");
    const header = page.locator("header");
    await expect(header.getByRole("button", { name: "Switch workspace" })).toBeVisible();
    await expect(header.getByRole("button", { name: "Resume" })).toBeVisible();
    await expect(header.getByRole("button", { name: "New practice" })).toBeVisible();

    await header.getByRole("button", { name: "Resume" }).click();
    await expect(page.getByRole("menuitem", { name: "Review resume" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Match to job" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "My resumes" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Review history" })).toBeVisible();
});

test("signed-in hire keeps organization context visible", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop navigation regression test");
    await mockSignedIn(page);

    await page.goto("/hire");
    const header = page.locator("header");
    await expect(header.getByRole("button", { name: "Switch workspace" })).toBeVisible();
    await expect(header.getByRole("button", { name: "Hiring organization" })).toContainText("Acme Hiring");
    await expect(header.getByRole("button", { name: "New assessment" })).toBeVisible();
});

test("practice interview uses distraction-free navigation", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop navigation regression test");
    await mockSignedIn(page);

    await page.goto("/practice/interviews/interview-1");
    const header = page.locator("header");
    await expect(header.getByText("Interview in progress")).toBeVisible();
    await expect(header.getByRole("link", { name: "Exit interview" })).toBeVisible();
    await expect(header.getByRole("button", { name: "New practice" })).toHaveCount(0);
    await expect(header.getByRole("button", { name: "Open navigation" })).toHaveCount(0);
});
