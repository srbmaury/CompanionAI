from pathlib import Path


def replace(path, old, new, count=1):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise RuntimeError(f"Expected snippet not found in {path}: {old[:150]!r}")
    p.write_text(text.replace(old, new, count))


# Shared browser auth mock now includes one Hiring organization.
replace(
    "client/e2e/productJourneys.spec.js",
    '''const mockSignedIn = async (page, user = { _id: "user-1", name: "Recruiter One", email: "recruiter@example.com", role: "user", plan: "free" }) => {
    await page.route("**/api/auth/refresh", (route) => json(route, { token: "test-access-token" }));
    await page.route("**/api/auth/profile", (route) => json(route, user));
};''',
    '''const mockSignedIn = async (page, user = { _id: "user-1", name: "Recruiter One", email: "recruiter@example.com", role: "user", plan: "free" }, organizationRole = "owner") => {
    await page.route("**/api/auth/refresh", (route) => json(route, { token: "test-access-token" }));
    await page.route("**/api/auth/profile", (route) => json(route, user));
    await page.route("**/api/organizations", (route) => json(route, {
        organizations: [{ _id: "org-1", name: "Acme Hiring", role: organizationRole, memberCount: 1 }],
    }));
};''',
)

# Two-account workspace browser test gets organization context for whichever user is active.
replace(
    "client/e2e/workspacePreference.spec.js",
    '    await page.route("**/api/auth/profile", (route) => json(route, currentUser));\n',
    '''    await page.route("**/api/auth/profile", (route) => json(route, currentUser));
    await page.route("**/api/organizations", (route) => json(route, {
        organizations: [{ _id: `org-${currentUser._id}`, name: `${currentUser.name} Hiring`, role: "owner", memberCount: 1 }],
    }));
''',
)

# Add a UI role check: reviewers can enter Hiring and Team, but cannot create assessments.
p = Path("client/e2e/productJourneys.spec.js")
text = p.read_text()
insert_before = 'test("candidate completes an assessment without seeing private feedback", async ({ page }) => {'
role_test = '''test("reviewer can inspect Hiring but cannot create assessments", async ({ page }) => {
    await mockSignedIn(page, undefined, "reviewer");
    await page.route("**/api/assessments/overview**", (route) => json(route, { summary: {}, assessments: [], candidates: [], totalPages: 1 }));
    await page.route("**/api/assessments?**", (route) => json(route, { items: [], totalPages: 1 }));
    await page.route("**/api/organizations/org-1/members", (route) => json(route, {
        currentRole: "reviewer",
        members: [{ _id: "membership-1", role: "reviewer", joinedAt: "2026-09-03T00:00:00Z", user: { _id: "user-1", name: "Recruiter One", email: "recruiter@example.com" } }],
    }));

    await page.goto("/assessments");
    await expect(page.getByRole("heading", { name: "Hiring overview" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New assessment" })).toHaveCount(0);

    if ((page.viewportSize()?.width || 0) >= 900) {
        await page.getByRole("link", { name: "Team" }).click();
    } else {
        await page.getByRole("button", { name: "Open navigation" }).click();
        await page.getByRole("menuitem", { name: "Team & organization" }).click();
    }
    await expect(page).toHaveURL(/\/hiring\/team$/);
    await expect(page.getByRole("heading", { name: "Team & organization" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Add existing CompanionAI user" })).toHaveCount(0);
});

'''
if role_test not in text:
    if insert_before not in text:
        raise RuntimeError('Could not locate browser role-test insertion point')
    text = text.replace(insert_before, role_test + insert_before, 1)
p.write_text(text)

print("Organization browser tests adapted")
