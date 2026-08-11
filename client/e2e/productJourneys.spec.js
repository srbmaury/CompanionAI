import { expect, test } from "@playwright/test";

const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const mockSignedOut = async (page) => {
    await page.route("**/api/auth/refresh", (route) => json(route, { message: "Unauthenticated" }, 401));
};

const mockSignedIn = async (page, user = { _id: "user-1", name: "Recruiter One", email: "recruiter@example.com", role: "user", plan: "free" }) => {
    await page.route("**/api/auth/refresh", (route) => json(route, { token: "test-access-token" }));
    await page.route("**/api/auth/profile", (route) => json(route, user));
};

test("public homepage explains both candidate and recruiter value", async ({ page }) => {
    await mockSignedOut(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Prepare better. Hire with clearer evidence." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Practice interviews" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Assess candidates" })).toBeVisible();
    await expect(page.getByText("Hiring workspace", { exact: true })).toBeVisible();
});

test("login survives a browser reload through refresh-token restoration", async ({ page }) => {
    let authenticated = false;
    await page.route("**/api/auth/refresh", (route) => authenticated
        ? json(route, { token: "restored-access-token" })
        : json(route, { message: "Unauthenticated" }, 401));
    await page.route("**/api/auth/login", (route) => {
        authenticated = true;
        return json(route, { token: "initial-access-token" });
    });
    await page.route("**/api/auth/profile", (route) => json(route, { _id: "user-1", name: "Test User", email: "test@example.com", role: "user", plan: "free" }));

    await page.goto("/login");
    await page.getByLabel("Email").fill("test@example.com");
    await page.locator("input#password").fill("StrongPass1!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: /Ready for the next one, Test/ })).toBeVisible();
});

test("recruiter can review and filter the cross-interview candidate pipeline", async ({ page }) => {
    await mockSignedIn(page);
    await page.route("**/api/assessments/overview**", (route) => json(route, {
        summary: { assessments: 2, activeAssessments: 1, totalCandidates: 3, submitted: 2, inProgress: 1, averageScore: 8.2 },
        assessments: [{ _id: "assessment-1", title: "Backend screen" }, { _id: "assessment-2", title: "Frontend screen" }],
        candidates: [{ _id: "attempt-1", candidateName: "Asha Candidate", candidateEmail: "asha@example.com", status: "submitted", overallScore: 8.5, startedAt: "2026-08-01T10:00:00Z", submittedAt: "2026-08-01T10:30:00Z", assessment: { _id: "assessment-1", title: "Backend screen", jobRole: "Backend Engineer", company: "Acme" } }],
        totalPages: 1,
    }));
    await page.route("**/api/assessments?**", (route) => json(route, { items: [{ _id: "assessment-1", title: "Backend screen", status: "active", jobRole: "Backend Engineer", company: "Acme", shareToken: "share-1", attemptCount: 2, submittedCount: 1 }], totalPages: 1 }));

    await page.goto("/assessments");
    await expect(page.getByRole("heading", { name: "Hiring overview" })).toBeVisible();
    await expect(page.getByText("Asha Candidate")).toBeVisible();
    await expect(page.getByText("8.5/10")).toBeVisible();
    await page.getByLabel("Search name or email").fill("Asha");
    await page.getByLabel("Status").click();
    await page.getByRole("option", { name: "Submitted" }).click();
    await expect(page.getByRole("link", { name: "Review" })).toHaveAttribute("href", "/assessments/assessment-1");
});

test("candidate completes an assessment without seeing private feedback", async ({ page }) => {
    await mockSignedOut(page);
    const assessment = { title: "Backend screen", company: "Acme", jobRole: "Backend Engineer", durationMinutes: 20, followUpsEnabled: false, candidateInstructions: "Answer from your own experience.", rounds: [{ name: "Technical", questionCount: 1 }] };
    const attempt = { _id: "attempt-1", rounds: [{ _id: "round-1", name: "Technical", description: "Practical judgment", questions: [{ _id: "question-1", text: "How do you make an API reliable?", answer: "" }] }] };
    await page.route("**/api/assessments/public/share-1", (route) => json(route, assessment));
    await page.route("**/api/assessments/public/share-1/start", (route) => json(route, { attempt, attemptToken: "attempt-secret" }, 201));
    await page.route("**/api/assessments/public/share-1/attempts/attempt-1/answer", async (route) => {
        const body = await route.request().postDataJSON();
        return json(route, { attempt: { ...attempt, rounds: [{ ...attempt.rounds[0], questions: [{ ...attempt.rounds[0].questions[0], answer: body.answer }] }] } });
    });
    await page.route("**/api/assessments/public/share-1/attempts/attempt-1/submit", (route) => json(route, { received: true }));

    await page.goto("/assessment/share-1");
    await expect(page.getByText("Scores and feedback are not shown to candidates.")).toBeVisible();
    await page.getByLabel("Full name").fill("Asha Candidate");
    await page.getByLabel("Email address").fill("asha@example.com");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Start assessment" }).click();
    await page.getByLabel("Your answer").fill("I use idempotency, timeouts, retries, monitoring, and tested rollback paths.");
    await page.getByRole("button", { name: "Save answer" }).click();
    await expect(page.getByText("1 of 1 complete")).toBeVisible();
    await page.getByRole("button", { name: "Submit assessment" }).click();
    await expect(page.getByRole("heading", { name: "Assessment submitted" })).toBeVisible();
    await expect(page.getByText(/score|feedback/i)).toHaveCount(0);
});
