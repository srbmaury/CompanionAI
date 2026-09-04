import { expect, test } from "@playwright/test";

const json = (route, body, status = 200) => route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
});

test("product preference stays scoped to the authenticated account", async ({ page }) => {
    let currentUser = {
        _id: "user-a",
        name: "User A",
        email: "a@example.com",
        role: "user",
        plan: "free",
    };

    await page.route("**/api/auth/refresh", (route) => json(route, { token: "test-access-token" }));
    await page.route("**/api/auth/profile", (route) => json(route, currentUser));
    await page.route("**/api/organizations**", (route) => json(route, {
        organizations: [{ _id: `org-${currentUser._id}`, name: `${currentUser.name} Hiring`, role: "owner", memberCount: 1 }],
    }));
    await page.route("**/api/events", (route) => json(route, { accepted: true }, 202));

    await page.goto("/hire");
    await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("companionai:workspace:user:user-a"))).toBe("hiring");

    currentUser = {
        _id: "user-b",
        name: "User B",
        email: "b@example.com",
        role: "user",
        plan: "free",
    };

    // A full navigation restores the session as the second account.
    await page.goto("/practice");
    await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();

    const stored = await page.evaluate(() => ({
        userA: localStorage.getItem("companionai:workspace:user:user-a"),
        userB: localStorage.getItem("companionai:workspace:user:user-b"),
    }));

    expect(stored.userA).toBe("hiring");
    expect(stored.userB).toBe("practice");
});
