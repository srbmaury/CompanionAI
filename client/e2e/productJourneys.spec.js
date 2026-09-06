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

const desktopNavigation = (page) => (page.viewportSize()?.width || 0) >= 1200;
const visibleMenuItem = (page, name) => page.getByRole("menuitem", { name }).filter({ visible: true });

const openProductNav = async (page) => {
    await page.getByRole("button", { name: "Open navigation" }).click();
};

const openHireFromPractice = async (page) => {
    if (desktopNavigation(page)) {
        await page.getByRole("button", { name: "Switch workspace" }).click();
        await visibleMenuItem(page, "Hire").click();
    } else {
        await openProductNav(page);
        await visibleMenuItem(page, "Hire").click();
    }
};

const openHireNavItem = async (page, name) => {
    if (desktopNavigation(page)) {
        await page.getByRole("button", { name, exact: true }).click();
    } else {
        await openProductNav(page);
        await visibleMenuItem(page, name).click();
    }
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
    await expect(page).toHaveURL(/\/practice\/dashboard$/);

    await page.reload();
    await expect(page).toHaveURL(/\/practice\/dashboard$/);
    await expect(page.getByRole("heading", { name: /Ready for the next one, Test/ })).toBeVisible();
});

test("login returns the user to the protected screen they requested", async ({ page }) => {
    let authenticated = false;
    await page.route("**/api/auth/refresh", (route) => authenticated ? json(route, { token: "restored-access-token" }) : json(route, { message: "Unauthenticated" }, 401));
    await page.route("**/api/auth/login", (route) => { authenticated = true; return json(route, { token: "access-token" }); });
    await page.route("**/api/auth/profile", (route) => json(route, { _id: "user-1", name: "Test User", email: "test@example.com", role: "user", practicePlan: "free" }));
    await page.route("**/api/billing/practice/entitlements", (route) => json(route, { plan: "free", limits: { interviews: 3, resumeReviews: 3 }, used: { interviews: 0, resumeReviews: 0 }, planLimits: {}, prices: {}, billingAvailable: {} }));

    await page.goto("/pricing");
    await expect(page).toHaveURL(/\/practice\/login$/);
    await page.getByLabel("Email").fill("test@example.com");
    await page.locator("input#password").fill("StrongPass1!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/practice\/pricing$/);
    await expect(page.getByRole("heading", { name: "Choose your Practice plan" })).toBeVisible();
});

test("Practice and Hire stay separate while navigation keeps every core action reachable", async ({ page }) => {
    await mockSignedIn(page);
    await page.route("**/api/assessments/overview**", (route) => json(route, { summary: {}, assessments: [], candidates: [], totalPages: 1 }));
    await page.route("**/api/assessments?**", (route) => json(route, { items: [], totalPages: 1 }));

    await page.goto("/practice/profile");
    await expect(page).toHaveURL(/\/practice\/profile$/);
    await expect(page.getByRole("heading", { name: "Profile & settings" })).toBeVisible();
    await expect(page.getByText("Your workspace", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Plan & billing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Security", exact: true })).toBeVisible();
    await expect(page.getByLabel("Primary goal")).not.toBeVisible();
    await page.getByRole("button", { name: /Practice preferences/ }).click();
    await expect(page.getByLabel("Primary goal")).toBeVisible();

    if (desktopNavigation(page)) {
        await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Progress" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Company insights" })).toBeVisible();
        await page.getByRole("button", { name: "Resume", exact: true }).click();
        await expect(visibleMenuItem(page, "Review resume")).toBeVisible();
        await page.keyboard.press("Escape");
    } else {
        await openProductNav(page);
        await expect(visibleMenuItem(page, "Review resume")).toBeVisible();
        await expect(visibleMenuItem(page, "Company insights")).toBeVisible();
        await page.keyboard.press("Escape");
    }

    await openHireFromPractice(page);
    await expect(page).toHaveURL(/\/hire\/assessments$/);
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

    await openHireNavItem(page, "Candidates");
    await expect(page).toHaveURL(/\/hire\/assessments#candidate-pipeline$/);
    await expect(page.getByRole("heading", { name: "Candidate pipeline" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Overview" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Assessments" })).toHaveCount(0);

    await openHireNavItem(page, "Assessments");
    await expect(page).toHaveURL(/\/hire\/assessments#assessment-list$/);
    await expect(page.getByRole("heading", { name: "Assessments" })).toBeVisible();

    await openHireNavItem(page, "New assessment");
    await expect(page).toHaveURL(/\/hire\/assessments\/new$/);
    await expect(page.getByRole("heading", { name: "Create an assessment" })).toBeVisible();
    await expect(page.getByText("Four focused steps.")).toBeVisible();
});

test("practice dashboard prioritizes continuing an unfinished interview", async ({ page }) => {
    await mockSignedIn(page, { _id: "user-1", name: "Practice User", email: "practice@example.com", role: "user", practicePlan: "free", targetRole: "Backend Engineer", weeklyPracticeTarget: 3 });
    await page.route("**/api/interviews/analytics/progress**", (route) => json(route, { completed: 2, averageScore: 7.8 }));
    await page.route("**/api/recommendations**", (route) => json(route, { actions: [{ id: "next", title: "Practice reliability", reason: "Your latest feedback suggests more reliability depth.", href: "/practice/new" }] }));
    await page.route("**/api/billing/practice/entitlements**", (route) => json(route, { plan: "free", limits: { interviews: 3, resumeReviews: 3 }, used: { interviews: 1, resumeReviews: 0 }, period: "month" }));
    await page.route("**/api/resumes**", (route) => json(route, { items: [], total: 0 }));
    await page.route("**/api/interviews**", (route) => json(route, {
        items: [{ _id: "interview-active", jobRole: "Backend Engineer", company: "Acme", createdAt: "2026-09-05T00:00:00Z", isCompleted: false, roundsCompleted: 1, roundsTotal: 3 }],
        total: 1,
        totalPages: 1,
    }));

    await page.goto("/practice/dashboard");
    await expect(page.getByRole("heading", { name: "Continue where you left off" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue interview" }).first()).toBeVisible();
    await expect(page.getByText("1/3 rounds complete")).toBeVisible();
});

test("practice sub-features remain reachable after navigation cleanup", async ({ page }) => {
    await mockSignedIn(page);
    await page.route("**/api/resumes**", (route) => json(route, []));
    await page.route("**/api/experiences/saved**", (route) => json(route, { items: [], totalPages: 1 }));

    await page.goto("/practice/resume-review");
    await expect(page.getByRole("link", { name: "Resume library" })).toHaveAttribute("href", "/practice/resumes");
    await expect(page.getByRole("link", { name: "Past reviews" })).toHaveAttribute("href", "/practice/resume-reviews");
    await expect(page.getByRole("link", { name: "Find best match" })).toHaveAttribute("href", "/practice/resume-match");

    await page.goto("/practice/company-insights");
    await expect(page.getByRole("link", { name: "Saved insights" })).toHaveAttribute("href", "/practice/saved-experiences");
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

    await page.goto("/hire/assessments");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByText("Asha Candidate")).toBeVisible();
    await expect(page.getByText("8.5/10")).toBeVisible();
    await page.getByLabel("Search name or email").fill("Asha");
    await page.getByLabel("Status").click();
    await page.getByRole("option", { name: "Submitted" }).click();
    await expect(page.getByRole("link", { name: "Review" })).toHaveAttribute("href", "/hire/assessments/assessment-1");
});

test("recruiter creates a hybrid assessment through the guided wizard", async ({ page }) => {
    await mockSignedIn(page);
    let published;
    await page.route("**/api/assessments", async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        published = await route.request().postDataJSON();
        return json(route, { _id: "assessment-hybrid", shareToken: "share-hybrid", ...published }, 201);
    });
    await page.route("**/api/assessments/assessment-hybrid", (route) => json(route, { assessment: { _id: "assessment-hybrid", shareToken: "share-hybrid", status: "active", title: "Hybrid engineering assessment", jobRole: "Senior Software Engineer" }, attempts: [] }));

    await page.goto("/hire/assessments?create=1");
    await expect(page).toHaveURL(/\/hire\/assessments\/new$/);
    await expect(page.getByRole("heading", { name: "What role are you hiring for?" })).toBeVisible();
    await page.getByRole("textbox", { name: "Job role" }).fill("Senior Software Engineer");
    await page.getByLabel("Assessment name").fill("Hybrid engineering assessment");
    await page.getByLabel("Job description and success criteria").fill("Evaluate communication, production coding, system design, scalability, reliability, testing, and security judgment.");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Build the interview plan" })).toBeVisible();
    await page.getByLabel("Maximum primary questions").fill("1");
    await page.getByRole("button", { name: "Add manual question" }).first().click();
    await page.getByRole("textbox", { name: "Question 1", exact: true }).first().fill("Describe a production incident you led and what changed afterward.");
    await page.getByRole("button", { name: "Add another round" }).click();
    await page.getByRole("button", { name: "Add another round" }).click();

    await page.getByLabel("Round name").nth(1).fill("Coding exercise");
    await page.getByRole("button", { name: "Coding / written", exact: true }).nth(1).click();
    await page.getByLabel("Question count").first().fill("1");
    await page.getByRole("button", { name: "Add manual question" }).nth(1).click();
    await page.getByRole("textbox", { name: "Question 1", exact: true }).nth(1).fill("Implement a function that returns the first non-repeating character.");

    await page.getByLabel("Round name").nth(2).fill("System design");
    await page.getByRole("button", { name: "System design", exact: true }).nth(2).click();
    await page.getByRole("button", { name: "Add manual question" }).nth(2).click();
    await page.getByRole("textbox", { name: "Question 1", exact: true }).nth(2).fill("Design a resilient global notification service.");

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Set up the candidate experience" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Review before candidates see it" })).toBeVisible();
    await page.getByRole("button", { name: "Publish now" }).click();

    await expect.poll(() => published?.rounds?.map((round) => round.deliveryMode)).toEqual(["conversational", "online-assessment", "system-design"]);
    expect(published.status).toBe("active");
    expect(published.rounds.every((round) => round.questionCount === 1)).toBeTruthy();
});

test("assessment wizard keeps in-progress setup after reload", async ({ page }) => {
    await mockSignedIn(page);
    await page.goto("/hire/assessments/new");
    await page.getByRole("textbox", { name: "Job role" }).fill("Platform Engineer");
    await page.getByLabel("Assessment name").fill("Platform Engineer Assessment");
    await page.getByLabel("Job description and success criteria").fill("Evaluate distributed systems, reliability, observability, incident response, and production engineering tradeoffs.");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Build the interview plan" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Build the interview plan" })).toBeVisible();
    await page.getByRole("button", { name: "Back" }).last().click();
    await expect(page.getByRole("textbox", { name: "Job role" })).toHaveValue("Platform Engineer");
    await expect(page.getByLabel("Assessment name")).toHaveValue("Platform Engineer Assessment");
});

test("reviewer can inspect Hiring but cannot create assessments", async ({ page }) => {
    await mockSignedIn(page, undefined, "reviewer");
    await page.route("**/api/assessments/overview**", (route) => json(route, { summary: {}, assessments: [], candidates: [], totalPages: 1 }));
    await page.route("**/api/assessments?**", (route) => json(route, { items: [], totalPages: 1 }));
    await page.route("**/api/organizations/org-1/members", (route) => json(route, {
        currentRole: "reviewer",
        members: [{ _id: "membership-1", role: "reviewer", joinedAt: "2026-09-03T00:00:00Z", user: { _id: "user-1", name: "Recruiter One", email: "recruiter@example.com" } }],
    }));

    await page.goto("/hire/assessments");
    await expect(page.getByRole("heading", { name: "Candidate pipeline" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Overview" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "New assessment" })).toHaveCount(0);

    if (desktopNavigation(page)) {
        await expect(page.getByRole("button", { name: "Team & billing" })).toHaveCount(0);
    } else {
        await openProductNav(page);
        await expect(visibleMenuItem(page, "Team & billing")).toHaveCount(0);
        await page.keyboard.press("Escape");
    }
    await page.goto("/hire/team");
    await expect(page).toHaveURL(/\/hire\/assessments#candidate-pipeline$/);
    await expect(page.getByRole("heading", { name: "Organization settings" })).toHaveCount(0);
});

test("candidate completes an assessment without seeing private feedback", async ({ page }) => {
    await mockSignedOut(page);
    const assessment = { title: "Backend screen", company: "Acme", jobRole: "Backend Engineer", durationMinutes: 20, followUpsEnabled: false, candidateInstructions: "Answer from your own experience.", rounds: [{ name: "Technical", deliveryMode: "conversational", questionCount: 1 }] };
    const attempt = { _id: "attempt-1", startedAt: new Date().toISOString(), rounds: [{ _id: "round-1", name: "Technical", description: "Practical judgment", deliveryMode: "conversational", adaptiveComplete: true, questions: [{ _id: "question-1", text: "How do you make an API reliable?", answer: "" }] }] };
    await page.route("**/api/assessments/public/share-1", (route) => json(route, assessment));
    await page.route("**/api/assessments/public/share-1/start", (route) => json(route, { attempt, attemptToken: "attempt-secret" }, 201));
    await page.route("**/api/assessments/public/share-1/attempts/attempt-1/answer", async (route) => {
        const body = await route.request().postDataJSON();
        return json(route, { attempt: { ...attempt, rounds: [{ ...attempt.rounds[0], questions: [{ ...attempt.rounds[0].questions[0], answer: body.answer }] }] } });
    });
    await page.route("**/api/assessments/public/share-1/attempts/attempt-1/submit", (route) => json(route, { received: true }));

    await page.goto("/assessment/share-1");
    await expect(page.getByRole("heading", { name: "Before you begin" })).toBeVisible();
    await expect(page.getByText(/score|private feedback/i)).toHaveCount(0);
    await page.getByLabel("Full name").fill("Asha Candidate");
    await page.getByLabel("Email address").fill("asha@example.com");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Start assessment" }).click();
    await page.getByRole("button", { name: "Type / code" }).click();
    await page.getByPlaceholder("Answer by typing or speaking...").fill("I use idempotency, timeouts, retries, monitoring, and tested rollback paths.");
    await page.getByRole("button", { name: "I’m done" }).click();
    await expect(page.getByRole("heading", { name: "Thanks — that wraps up Technical." })).toBeVisible();
    await page.getByRole("button", { name: "Review and submit" }).click();
    await expect(page.getByRole("heading", { name: "Interview complete" })).toBeVisible();
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
    await expect(page.getByRole("heading", { name: "Implement a function that removes duplicate IDs." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Speak question" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start voice" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Editor content" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Explain your approach" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run" })).toBeVisible();
    await page.getByRole("button", { name: "Use text answer" }).click();
    await expect(page.getByPlaceholder("Answer by typing or speaking...")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Editor content" })).toHaveCount(0);
});

test("candidate sees the hybrid interview plan while future live rounds stay locked", async ({ page }) => {
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
    await expect(page.getByRole("button", { name: /Conversational/ })).toBeEnabled();
    await expect(page.getByRole("button", { name: /Coding exercise/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: /System design/ })).toBeDisabled();
    await expect(page.getByText(/Live rounds advance sequentially/)).toBeVisible();
});

test("candidate stays on the question when saving fails", async ({ page }) => {
    await mockSignedOut(page);
    const assessment = { title: "Reliability screen", jobRole: "Engineer", durationMinutes: 20, followUpsEnabled: false, rounds: [{ name: "Technical", deliveryMode: "conversational", questionCount: 2 }] };
    const attempt = { _id: "attempt-failure", startedAt: new Date().toISOString(), rounds: [{ _id: "round-failure", name: "Technical", deliveryMode: "conversational", adaptiveComplete: true, questions: [
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
    await page.getByRole("button", { name: "Type / code" }).click();
    const answer = page.getByPlaceholder("Answer by typing or speaking...");
    await answer.fill("I use health gates, canaries, and a tested rollback command.");
    await page.getByRole("button", { name: "I’m done" }).click();
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
        ["/practice/profile", "Profile & settings"],
        ["/practice/progress", "Your progress"],
        ["/practice/resumes", "Resumes"],
        ["/practice/resume-review", "AI resume review"],
        ["/practice/resume-reviews", "Resume review history"],
        ["/practice/resume-match", "Find your best resume for a job"],
        ["/practice/company-insights", "Company interview insights"],
        ["/practice/saved-experiences", "Saved company insights"],
        ["/practice/pricing", "Choose your Practice plan"],
        ["/hire/assessments", "Hiring workspace"],
        ["/hire/assessments/new", "Create an assessment"],
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
        ["/login", "Sign in to Evalcue AI"],
        ["/register", "Create your Evalcue AI account"],
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