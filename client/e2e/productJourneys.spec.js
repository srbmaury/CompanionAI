import { expect, test } from "@playwright/test";

const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const mockSignedOut = async (page) => {
    await page.route("**/api/auth/refresh", (route) => json(route, { message: "Unauthenticated" }, 401));
};

const mockSignedIn = async (page, user = { _id: "user-1", name: "Recruiter One", email: "recruiter@example.com", role: "user", practicePlan: "free" }, organizationRole = "owner") => {
    await page.route("**/api/auth/refresh", (route) => json(route, { token: "test-access-token" }));
    await page.route("**/api/auth/profile", (route) => json(route, user));
    await page.route("**/api/organizations", (route) => json(route, {
        organizations: [{ _id: "org-1", name: "Acme Hiring", role: organizationRole, memberCount: 1 }],
    }));
    await page.route("**/api/billing/hiring/entitlements", (route) => json(route, {
        product: "hiring",
        organization: { _id: "org-1", name: "Acme Hiring" },
        plan: "trial",
        subscriptionStatus: "inactive",
        period: "lifetime",
        periodType: "lifetime",
        limits: { candidateInterviews: 5 },
        used: { candidateInterviews: 1 },
        planLimits: { trial: { candidateInterviews: 5 }, starter: { candidateInterviews: 25 }, growth: { candidateInterviews: 100 }, enterprise: { candidateInterviews: 100000 } },
        prices: {},
        billingAvailable: {},
        canManageBilling: ["owner", "admin"].includes(organizationRole),
    }));
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
    await page.route("**/api/auth/profile", (route) => json(route, { _id: "user-1", name: "Test User", email: "test@example.com", role: "user", practicePlan: "free" }));

    await page.goto("/login");
    await page.getByLabel("Email").fill("test@example.com");
    await page.locator("input#password").fill("StrongPass1!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: /Ready for the next one, Test/ })).toBeVisible();
});

test("login returns the user to the protected screen they requested", async ({ page }) => {
    let authenticated = false;
    await page.route("**/api/auth/refresh", (route) => authenticated ? json(route, { token: "restored-access-token" }) : json(route, { message: "Unauthenticated" }, 401));
    await page.route("**/api/auth/login", (route) => { authenticated = true; return json(route, { token: "access-token" }); });
    await page.route("**/api/auth/profile", (route) => json(route, { _id: "user-1", name: "Test User", email: "test@example.com", role: "user", practicePlan: "free" }));
    await page.route("**/api/billing/practice/entitlements", (route) => json(route, { plan: "free", limits: { interviews: 3, resumeReviews: 3 }, used: { interviews: 0, resumeReviews: 0 }, planLimits: {}, prices: {}, billingAvailable: {} }));

    await page.goto("/pricing");
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel("Email").fill("test@example.com");
    await page.locator("input#password").fill("StrongPass1!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/pricing$/);
    await expect(page.getByRole("heading", { name: "Choose your Practice plan" })).toBeVisible();
});

test("practice and hiring stay separate while profile keeps advanced settings collapsed", async ({ page }) => {
    await mockSignedIn(page);
    await page.route("**/api/assessments/overview**", (route) => json(route, { summary: {}, assessments: [], candidates: [], totalPages: 1 }));
    await page.route("**/api/assessments?**", (route) => json(route, { items: [], totalPages: 1 }));

    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Profile & settings" })).toBeVisible();
    await expect(page.getByText("Your workspace", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Plan & billing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Security", exact: true })).toBeVisible();
    await expect(page.getByLabel("Primary goal")).not.toBeVisible();
    await page.getByRole("button", { name: /Practice preferences/ }).click();
    await expect(page.getByLabel("Primary goal")).toBeVisible();

    if ((page.viewportSize()?.width || 0) >= 900) {
        await expect(page.getByRole("link", { name: "Resume review" })).toHaveAttribute("href", "/resume-review");
        await expect(page.getByRole("link", { name: "Progress" })).toHaveAttribute("href", "/progress");
        await expect(page.getByRole("link", { name: "Company insights" })).toHaveAttribute("href", "/experiences");
    } else {
        await page.getByRole("button", { name: "Open navigation" }).click();
        await expect(page.getByRole("menuitem", { name: "Resume review" })).toBeVisible();
        await expect(page.getByRole("menuitem", { name: "Company insights" })).toBeVisible();
        await page.keyboard.press("Escape");
    }

    await page.getByRole("button", { name: "Switch workspace" }).click();
    await page.getByRole("menuitem", { name: /Hiring/ }).click();
    await expect(page).toHaveURL(/\/assessments$/);
    await expect(page.getByRole("heading", { name: "Hiring overview" })).toBeVisible();
    if ((page.viewportSize()?.width || 0) >= 900) {
        await page.getByRole("button", { name: "Candidate pipeline", exact: true }).click();
    } else {
        await page.getByRole("button", { name: "Open navigation" }).click();
        await page.getByRole("menuitem", { name: "Candidate pipeline" }).click();
    }
    await expect(page).toHaveURL(/\/assessments#candidate-pipeline$/);
    await expect(page.getByRole("heading", { name: "Candidate pipeline" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Hiring overview" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Your assessments" })).toHaveCount(0);

    if ((page.viewportSize()?.width || 0) >= 900) {
        await page.getByRole("button", { name: "Assessments", exact: true }).click();
    } else {
        await page.getByRole("button", { name: "Open navigation" }).click();
        await page.getByRole("menuitem", { name: "Assessments", exact: true }).click();
    }
    await expect(page).toHaveURL(/\/assessments#assessment-list$/);
    await expect(page.getByRole("heading", { name: "Your assessments" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Candidate pipeline" })).toHaveCount(0);
    if ((page.viewportSize()?.width || 0) >= 900) {
        await page.getByRole("button", { name: "New assessment" }).click();
    } else {
        await page.getByRole("button", { name: "Open navigation" }).click();
        await page.getByRole("menuitem", { name: "New assessment" }).click();
    }
    await expect(page).toHaveURL(/\/assessments\?create=1$/);
    await expect(page.getByRole("heading", { name: "Create assessment", exact: true })).toBeVisible();
});

test("practice sub-features remain reachable after navigation cleanup", async ({ page }) => {
    await mockSignedIn(page);
    await page.route("**/api/resumes**", (route) => json(route, []));
    await page.route("**/api/experiences/saved**", (route) => json(route, { items: [], totalPages: 1 }));

    await page.goto("/resume-review");
    await expect(page.getByRole("link", { name: "Resume library" })).toHaveAttribute("href", "/resumes");
    await expect(page.getByRole("link", { name: "Past reviews" })).toHaveAttribute("href", "/resume-reviews");
    await expect(page.getByRole("link", { name: "Find best match" })).toHaveAttribute("href", "/resume-match");

    await page.goto("/experiences");
    await expect(page.getByRole("link", { name: "Saved insights" })).toHaveAttribute("href", "/saved-experiences");
});

test("recruiter can review and filter the cross-interview candidate pipeline", async ({ page }) => {
    await mockSignedIn(page);
    await page.route("**/api/assessments/overview**", (route) => json(route, {
        summary: { assessments: 2, activeAssessments: 1, totalCandidates: 3, submitted: 2, inProgress: 1, averageScore: 8.2 },
        assessments: [{ _id: "assessment-1", title: "Backend screen" }, { _id: "assessment-2", title: "Frontend screen" }],
        candidates: [{ _id: "attempt-1", candidateName: "Asha Candidate", candidateEmail: "asha@example.com", status: "submitted", overallScore: 8.5, startedAt: "2026-08-01T10:00:00Z", submittedAt: "2026-08-01T10:30:00Z", assessment: { _id: "assessment-1", title: "Backend screen", jobRole: "Backend Engineer", company: "Acme" } }],
        totalPages: 1,
    }));
    await page.route("**/api/assessments?**", (route) => json(route, { items: [{ _id: "assessment-1", title: "Backend screen", status: "active", jobRole: "Backend Engineer", organizationName: "Acme", shareToken: "share-1", attemptCount: 2, submittedCount: 1 }], totalPages: 1 }));

    await page.goto("/assessments");
    await expect(page.getByRole("heading", { name: "Hiring overview" })).toBeVisible();
    await expect(page.getByText("Asha Candidate")).toBeVisible();
    await expect(page.getByText("8.5/10")).toBeVisible();
    await page.getByLabel("Search name or email").fill("Asha");
    await page.getByLabel("Status").click();
    await page.getByRole("option", { name: "Submitted" }).click();
    await expect(page.getByRole("link", { name: "Review" })).toHaveAttribute("href", "/assessments/assessment-1");
});

test("recruiter can publish a hybrid assessment with all candidate experiences", async ({ page }) => {
    await mockSignedIn(page);
    let published;
    await page.route("**/api/assessments/overview**", (route) => json(route, { summary: {}, assessments: [], candidates: [], totalPages: 1 }));
    await page.route("**/api/assessments?**", (route) => json(route, { items: [], totalPages: 1 }));
    await page.route("**/api/assessments", async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        published = await route.request().postDataJSON();
        return json(route, { _id: "assessment-hybrid", shareToken: "share-hybrid", ...published }, 201);
    });

    await page.goto("/assessments?create=1");
    await page.getByLabel("Assessment name").fill("Hybrid engineering assessment");
    await page.getByRole("textbox", { name: "Job role" }).fill("Senior Software Engineer");
    await page.getByLabel("Job description and success criteria").fill("Evaluate communication, production coding, system design, scalability, reliability, testing, and security judgment.");

    await page.getByLabel("Number of questions").first().fill("1");
    await page.getByRole("button", { name: "Add manual question" }).first().click();
    await page.getByRole("textbox", { name: "Question 1", exact: true }).first().fill("Describe a production incident you led and what changed afterward.");
    await page.getByRole("button", { name: "Add round" }).click();
    await page.getByRole("button", { name: "Add round" }).click();

    await page.getByLabel("Round label").nth(1).fill("Coding exercise");
    await page.getByLabel("Candidate experience").nth(1).click();
    await page.getByRole("option", { name: "Coding / written assessment" }).click();
    await page.getByLabel("Number of questions").nth(1).fill("1");
    await page.getByRole("button", { name: "Add manual question" }).nth(1).click();
    await page.getByRole("textbox", { name: "Question 1", exact: true }).nth(1).fill("Implement a function that returns the first non-repeating character.");

    await page.getByLabel("Round label").nth(2).fill("System design");
    await page.getByLabel("Candidate experience").nth(2).click();
    await page.getByRole("option", { name: "System design canvas + discussion" }).click();
    await expect(page.getByLabel("Number of questions").nth(2)).toHaveValue("1");
    await page.getByRole("button", { name: "Add manual question" }).nth(2).click();
    await page.getByRole("textbox", { name: "Question 1", exact: true }).nth(2).fill("Design a resilient global notification service.");

    await page.getByRole("button", { name: "Publish now" }).click();
    await expect.poll(() => published?.rounds?.map((round) => round.deliveryMode)).toEqual(["conversational", "online-assessment", "system-design"]);
    expect(published.status).toBe("active");
    expect(published.rounds.every((round) => round.questionCount === 1)).toBeTruthy();
});

test("reviewer can inspect Hiring but cannot create assessments", async ({ page }) => {
    await mockSignedIn(page, undefined, "reviewer");
    await page.route("**/api/assessments/overview**", (route) => json(route, { summary: {}, assessments: [], candidates: [], totalPages: 1 }));
    await page.route("**/api/assessments?**", (route) => json(route, { items: [], totalPages: 1 }));
    await page.route("**/api/organizations/org-1/members", (route) => json(route, {
        currentRole: "reviewer",
        members: [{ _id: "membership-1", role: "reviewer", joinedAt: "2026-09-03T00:00:00Z", user: { _id: "user-1", name: "Recruiter One", email: "recruiter@example.com" } }],
    }));

    await page.goto("/assessments");
    await expect(page.getByRole("heading", { name: "Candidate pipeline" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Hiring overview" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "New assessment" })).toHaveCount(0);

    if ((page.viewportSize()?.width || 0) >= 900) {
        await expect(page.getByRole("link", { name: "Team & billing" })).toHaveCount(0);
    } else {
        await page.getByRole("button", { name: "Open navigation" }).click();
        await expect(page.getByRole("menuitem", { name: "Team & Hiring billing" })).toHaveCount(0);
        await page.keyboard.press("Escape");
    }
    await page.goto("/hiring/team");
    await expect(page).toHaveURL(/\/assessments#candidate-pipeline$/);
    await expect(page.getByRole("heading", { name: "Organization settings" })).toHaveCount(0);
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
    await expect(page.getByText("Scores and private feedback are not shown to candidates.")).toBeVisible();
    await page.getByLabel("Full name").fill("Asha Candidate");
    await page.getByLabel("Email address").fill("asha@example.com");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Start assessment" }).click();
    await page.getByPlaceholder("Answer by typing or speaking...").fill("I use idempotency, timeouts, retries, monitoring, and tested rollback paths.");
    await page.getByRole("button", { name: "Save answer" }).click();
    await expect(page.getByText("1 of 1 complete")).toBeVisible();
    await page.getByRole("button", { name: "Submit assessment" }).click();
    await expect(page.getByRole("heading", { name: "Assessment submitted" })).toBeVisible();
    await expect(page.getByText(/score|feedback/i)).toHaveCount(0);
});

test("recruiter coding assessment uses the full interview workspace", async ({ page }) => {
    await mockSignedOut(page);
    const assessment = { title: "Frontend practical", company: "Acme", jobRole: "Frontend Engineer", durationMinutes: 30, followUpsEnabled: true, candidateInstructions: "Explain your tradeoffs aloud.", rounds: [{ name: "Coding", deliveryMode: "online-assessment", questionCount: 1 }] };
    const attempt = { _id: "attempt-code", rounds: [{ _id: "round-code", name: "Coding", description: "Implementation and communication", deliveryMode: "online-assessment", questions: [{ _id: "question-code", text: "Implement a function that removes duplicate IDs.", answer: "" }] }] };
    await page.route("**/api/assessments/public/share-code", (route) => json(route, assessment));
    await page.route("**/api/assessments/public/share-code/start", (route) => json(route, { attempt, attemptToken: "attempt-code-secret" }, 201));

    await page.goto("/assessment/share-code");
    await page.getByLabel("Full name").fill("Dev Candidate");
    await page.getByLabel("Email address").fill("dev@example.com");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Start assessment" }).click();

    await expect(page.getByText("Coding / written")).toBeVisible();
    await expect(page.getByText("Interview in progress")).toBeVisible();
    await expect(page.getByRole("button", { name: "Speak question" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start voice" })).toBeVisible();
    await expect(page.getByLabel("Spoken explanation")).toBeVisible();
    await expect(page.getByText("Voice will fill: Spoken explanation")).toBeVisible();
    await page.getByRole("button", { name: "Use text answer" }).click();
    await expect(page.getByPlaceholder("Answer by typing or speaking...")).toBeVisible();
    await expect(page.getByLabel("Spoken explanation")).toHaveCount(0);
    await page.getByPlaceholder("Answer by typing or speaking...").focus();
    await expect(page.getByText("Voice will fill: Answer")).toBeVisible();
    await page.getByRole("button", { name: "Use code editor" }).click();
    await expect(page.getByLabel("Spoken explanation")).toBeVisible();
    await page.getByLabel("Spoken explanation").focus();
    await expect(page.getByText("Voice will fill: Spoken explanation")).toBeVisible();
});

test("candidate can move between conversational, coding, and system-design rounds", async ({ page }) => {
    await mockSignedOut(page);
    const rounds = [
        { _id: "round-talk", name: "Conversational", description: "Communication", deliveryMode: "conversational", questions: [{ _id: "question-talk", text: "Describe an incident you led.", answer: "" }] },
        { _id: "round-code", name: "Coding exercise", description: "Implementation", deliveryMode: "online-assessment", questions: [{ _id: "question-code", text: "Implement a function that removes duplicates.", answer: "" }] },
        { _id: "round-design", name: "System design", description: "Architecture", deliveryMode: "system-design", questions: [{ _id: "question-design", text: "Design a global notification service.", answer: "" }] },
    ];
    await page.route("**/api/assessments/public/share-hybrid", (route) => json(route, {
        title: "Three-format assessment", jobRole: "Senior Engineer", durationMinutes: 30,
        followUpsEnabled: false, candidateInstructions: "Explain your assumptions.",
        rounds: rounds.map(({ name, deliveryMode, questions }) => ({ name, deliveryMode, questionCount: questions.length })),
    }));
    await page.route("**/api/assessments/public/share-hybrid/start", (route) => json(route, {
        attempt: { _id: "attempt-hybrid", rounds }, attemptToken: "attempt-hybrid-secret",
    }, 201));

    await page.goto("/assessment/share-hybrid");
    await page.getByLabel("Full name").fill("Hybrid Candidate");
    await page.getByLabel("Email address").fill("hybrid@example.com");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Start assessment" }).click();

    await expect(page.getByRole("heading", { name: "Describe an incident you led." })).toBeVisible();
    await expect(page.getByRole("button", { name: /Conversational/ })).toBeVisible();
    await page.getByRole("button", { name: /Coding exercise/ }).click();
    await expect(page.getByRole("heading", { name: "Implement a function that removes duplicates." })).toBeVisible();
    await expect(page.getByText("Coding / written", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /System design/ }).click();
    await expect(page.getByRole("heading", { name: "Design a global notification service." })).toBeVisible();
    await expect(page.getByText("Your diagram is part of the interview")).toBeVisible();
    await expect(page.getByText("Architecture diagram", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/reads component labels and bound connections/)).toBeVisible();
    await expect(page.getByLabel("Spoken explanation")).toBeVisible();
});

test("candidate stays on the question when saving fails", async ({ page }) => {
    await mockSignedOut(page);
    const assessment = { title: "Reliability screen", jobRole: "Engineer", durationMinutes: 20, followUpsEnabled: false, rounds: [{ name: "Technical", deliveryMode: "conversational", questionCount: 2 }] };
    const attempt = { _id: "attempt-failure", rounds: [{ _id: "round-failure", name: "Technical", deliveryMode: "conversational", questions: [
        { _id: "question-failure-1", text: "Describe your rollback strategy.", answer: "" },
        { _id: "question-failure-2", text: "How do you monitor deployments?", answer: "" },
    ] }] };
    await page.route("**/api/assessments/public/share-failure", (route) => json(route, assessment));
    await page.route("**/api/assessments/public/share-failure/start", (route) => json(route, { attempt, attemptToken: "attempt-failure-secret" }, 201));
    await page.route("**/api/assessments/public/share-failure/attempts/attempt-failure/answer", (route) => json(route, { message: "Temporary save failure" }, 503));

    await page.goto("/assessment/share-failure");
    await page.getByLabel("Full name").fill("Resilient Candidate");
    await page.getByLabel("Email address").fill("resilient@example.com");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Start assessment" }).click();
    const answer = page.getByPlaceholder("Answer by typing or speaking...");
    await answer.fill("I use health gates, canaries, and a tested rollback command.");
    await page.getByRole("button", { name: "Save answer" }).click();
    await expect(page.getByText("Temporary save failure")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Describe your rollback strategy." })).toBeVisible();
    await expect(answer).toHaveValue("I use health gates, canaries, and a tested rollback command.");
});

test("supporting authenticated screens render without overflow", async ({ page }) => {
    test.setTimeout(60000);
    await mockSignedIn(page, { _id: "admin-1", name: "Admin User", email: "admin@example.com", role: "admin", plan: "scale" });
    await page.route("**/api/events", (route) => json(route, { recorded: true }, 201));
    await page.route("**/api/resumes**", (route) => json(route, []));
    await page.route("**/api/resumes/reviews**", (route) => json(route, { items: [], totalPages: 1 }));
    await page.route("**/api/experiences/saved**", (route) => json(route, { items: [], totalPages: 1 }));
    await page.route("**/api/interviews/analytics/progress**", (route) => json(route, { total: 0, completed: 0, averageScore: 0, improvement: 0, recentScores: [], skills: [] }));
    await page.route("**/api/billing/practice/entitlements**", (route) => json(route, { plan: "pro", limits: { interviews: 100, resumeReviews: 100 }, used: { interviews: 0, resumeReviews: 0 }, planLimits: {}, prices: {}, billingAvailable: {} }));
    await page.route("**/api/assessments/overview**", (route) => json(route, { summary: {}, assessments: [], candidates: [], totalPages: 1 }));
    await page.route("**/api/assessments?**", (route) => json(route, { items: [], totalPages: 1 }));
    await page.route("**/api/admin/overview**", (route) => json(route, { users: 0, activeSubscriptions: 0, openFeedback: 0, assessments: 0 }));
    await page.route("**/api/admin/feedback**", (route) => json(route, { items: [], totalPages: 1 }));
    await page.route("**/api/admin/audit**", (route) => json(route, { items: [], totalPages: 1 }));

    const screens = [
        ["/profile", "Profile & settings"],
        ["/progress", "Your progress"],
        ["/resumes", "Resumes"],
        ["/resume-review", "AI resume review"],
        ["/resume-reviews", "Resume review history"],
        ["/resume-match", "Find your best resume for a job"],
        ["/experiences", "Company interview insights"],
        ["/saved-experiences", "Saved company insights"],
        ["/pricing", "Choose your Practice plan"],
        ["/assessments", "Candidate assessments"],
        ["/admin/feedback", "Product feedback"],
        ["/admin/audit", "Audit activity"],
    ];
    for (const [path, heading] of screens) {
        await page.goto(path);
        await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    }
});

test("public account and legal screens have clear page titles without overflow", async ({ page }) => {
    await mockSignedOut(page);
    const screens = [
        ["/login", "Sign in to CompanionAI"],
        ["/register", "Create your CompanionAI account"],
        ["/forgot-password", "Forgot your password?"],
        ["/reset-password", "Reset your password"],
        ["/verify-email", "Verify your email"],
        ["/privacy", "Privacy notice"],
        ["/terms", "Terms of use"],
    ];
    for (const [path, heading] of screens) {
        await page.goto(path);
        await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    }
});
