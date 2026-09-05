import { expect, test } from "@playwright/test";

const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const mockSignedOut = async (page) => {
    await page.route("**/api/auth/refresh", (route) => json(route, { message: "Unauthenticated" }, 401));
};

const mockSignedIn = async (page, organizationRole = "owner") => {
    await page.route("**/api/auth/refresh", (route) => json(route, { token: "test-access-token" }));
    await page.route("**/api/auth/profile", (route) => json(route, {
        _id: "user-1",
        name: "Recruiter One",
        email: "recruiter@example.com",
        role: "user",
        practicePlan: "free",
    }));
    await page.route("**/api/organizations", (route) => json(route, {
        organizations: [{ _id: "org-1", name: "Acme Hiring", role: organizationRole, memberCount: 4 }],
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
        planLimits: {
            trial: { candidateInterviews: 5 },
            starter: { candidateInterviews: 25 },
            growth: { candidateInterviews: 100 },
            enterprise: { candidateInterviews: 100000 },
        },
        prices: {},
        billingAvailable: {},
        canManageBilling: ["owner", "admin"].includes(organizationRole),
    }));
};

const mockEmptyHiringWorkspace = async (page, onPublish) => {
    await page.route("**/api/assessments/overview**", (route) => json(route, {
        summary: {}, assessments: [], candidates: [], totalPages: 1,
    }));
    await page.route("**/api/assessments?**", (route) => json(route, { items: [], totalPages: 1 }));
    await page.route("**/api/assessments", async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        const payload = await route.request().postDataJSON();
        onPublish?.(payload);
        return json(route, { _id: "assessment-created", shareToken: "share-created", ...payload }, 201);
    });
};

const startPublicAssessment = async (page, shareToken, name = "Candidate", email = "candidate@example.com") => {
    await page.goto(`/assessment/${shareToken}`);
    await page.getByLabel("Full name").fill(name);
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: "Start assessment" }).click();
};

test("recruiter can lock the interview to reviewed primary questions while keeping AI follow-ups enabled", async ({ page }) => {
    await mockSignedIn(page);
    let published;
    await mockEmptyHiringWorkspace(page, (payload) => { published = payload; });

    await page.goto("/hire/assessments?create=1");
    await expect(page.getByRole("heading", { name: "Create assessment", exact: true })).toBeVisible();
    await page.getByRole("textbox", { name: "Job role" }).fill("Senior Backend Engineer");
    await page.getByLabel("Assessment name").fill("Backend evidence interview");
    await page.getByLabel("Job description and success criteria").fill("Own reliable backend systems, APIs, incident response, testing, observability, and architecture trade-offs in production.");

    await expect(page.getByLabel("Maximum questions")).toHaveValue("3");
    const adaptiveToggle = page.getByLabel(/^Allow AI to generate additional interview questions/);
    await expect(adaptiveToggle).toBeChecked();
    await expect(page.getByText("Adaptive primary questions", { exact: true })).toBeVisible();
    await adaptiveToggle.uncheck();

    const fixedCount = page.getByLabel("Question count");
    await expect(fixedCount).toBeDisabled();
    await expect(fixedCount).toHaveValue("1");
    await expect(page.getByText("Recruiter question set only", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Add manual question" }).click();
    await page.getByRole("textbox", { name: "Question 1", exact: true }).fill("Describe a production reliability decision you made and the trade-off you accepted.");
    await expect(page.getByText("Fixed interview question", { exact: true })).toBeVisible();
    await expect(page.getByLabel(/^AI contextual follow-ups/)).toBeChecked();

    await page.getByRole("button", { name: "Publish now" }).click();
    await expect.poll(() => published).toBeTruthy();
    expect(published.status).toBe("active");
    expect(published.followUpsEnabled).toBe(true);
    expect(published.rounds).toHaveLength(1);
    expect(published.rounds[0].adaptive).toBe(false);
    expect(published.rounds[0].questionCount).toBe(1);
    expect(published.rounds[0].questions).toEqual([
        expect.objectContaining({
            text: "Describe a production reliability decision you made and the trade-off you accepted.",
            required: true,
        }),
    ]);
});

test("adaptive conversational interview advances into a server-generated primary question", async ({ page }) => {
    await mockSignedOut(page);
    const shareToken = "share-adaptive-primary";
    const firstQuestion = { _id: "question-1", text: "Tell me about a difficult production incident.", answer: "", followUpNumber: 0, followUps: [] };
    const secondQuestion = { _id: "question-2", text: "How would you reduce blast radius in the next release?", answer: "", followUpNumber: 0, followUps: [] };
    const round = { _id: "round-1", name: "Technical judgment", deliveryMode: "conversational", adaptive: true, questions: [firstQuestion] };

    await page.route(`**/api/assessments/public/${shareToken}`, (route) => json(route, {
        title: "Adaptive backend interview",
        jobRole: "Backend Engineer",
        durationMinutes: 30,
        followUpsEnabled: false,
        rounds: [{ name: round.name, deliveryMode: round.deliveryMode, adaptive: true, questionCount: 3 }],
    }));
    await page.route(`**/api/assessments/public/${shareToken}/start`, (route) => json(route, {
        attemptToken: "attempt-secret",
        attempt: { _id: "attempt-1", rounds: [round] },
    }, 201));
    await page.route(`**/api/assessments/public/${shareToken}/attempts/attempt-1/answer`, async (route) => {
        const body = await route.request().postDataJSON();
        expect(route.request().headers()["x-attempt-token"]).toBe("attempt-secret");
        return json(route, {
            attempt: {
                _id: "attempt-1",
                rounds: [{ ...round, questions: [{ ...firstQuestion, answer: body.answer }, secondQuestion] }],
            },
        });
    });

    await startPublicAssessment(page, shareToken, "Adaptive Candidate", "adaptive@example.com");
    await expect(page.getByRole("heading", { name: firstQuestion.text })).toBeVisible();
    await page.getByPlaceholder("Answer by typing or speaking...").fill("I stabilized traffic, narrowed the failure domain, rolled back safely, and added release health gates.");
    await page.getByRole("button", { name: "Save answer and continue interview" }).click();

    await expect(page.getByRole("heading", { name: secondQuestion.text })).toBeVisible();
    await expect(page.getByText("1 of 2 complete", { exact: true })).toBeVisible();
    await expect(page.getByText("Adaptive conversation", { exact: true })).toBeVisible();
});

test("candidate completes all three chained AI follow-ups before a conversational question is marked complete", async ({ page }) => {
    await mockSignedOut(page);
    const shareToken = "share-three-followups";
    const followUpQuestions = [
        "What signal told you the mitigation was working?",
        "How did you prevent the same class of incident from recurring?",
        "What trade-off did your prevention introduce?",
    ];
    const primary = { _id: "question-1", text: "Describe a production incident you owned end to end.", answer: "", followUpNumber: 0, followUpQuestion: "", followUpAnswer: "", followUps: [] };
    const roundBase = { _id: "round-1", name: "Incident response", deliveryMode: "conversational", adaptive: false };
    let currentQuestion = { ...primary };
    let answerRequests = 0;

    await page.route(`**/api/assessments/public/${shareToken}`, (route) => json(route, {
        title: "Incident response interview",
        jobRole: "Senior Engineer",
        durationMinutes: 30,
        followUpsEnabled: true,
        rounds: [{ name: roundBase.name, deliveryMode: "conversational", adaptive: false, questionCount: 1 }],
    }));
    await page.route(`**/api/assessments/public/${shareToken}/start`, (route) => json(route, {
        attemptToken: "followup-secret",
        attempt: { _id: "attempt-followups", rounds: [{ ...roundBase, questions: [currentQuestion] }] },
    }, 201));
    await page.route(`**/api/assessments/public/${shareToken}/attempts/attempt-followups/answer`, async (route) => {
        const body = await route.request().postDataJSON();
        expect(route.request().headers()["x-attempt-token"]).toBe("followup-secret");
        answerRequests += 1;

        if (body.answer) {
            currentQuestion = {
                ...currentQuestion,
                answer: body.answer,
                followUpQuestion: followUpQuestions[0],
                followUpAnswer: "",
                followUpNumber: 1,
            };
        } else {
            const answeredFollowUp = {
                question: currentQuestion.followUpQuestion,
                answer: body.followUpAnswer,
            };
            const followUps = [...(currentQuestion.followUps || []), answeredFollowUp];
            const nextIndex = followUps.length;
            currentQuestion = nextIndex < followUpQuestions.length
                ? {
                    ...currentQuestion,
                    followUps,
                    followUpQuestion: followUpQuestions[nextIndex],
                    followUpAnswer: "",
                    followUpNumber: nextIndex + 1,
                }
                : {
                    ...currentQuestion,
                    followUps,
                    followUpQuestion: "",
                    followUpAnswer: "",
                    followUpNumber: 0,
                };
        }

        return json(route, {
            attempt: { _id: "attempt-followups", rounds: [{ ...roundBase, questions: [currentQuestion] }] },
        });
    });
    await page.route(`**/api/assessments/public/${shareToken}/attempts/attempt-followups/submit`, (route) => json(route, { received: true }));

    await startPublicAssessment(page, shareToken, "Followup Candidate", "followups@example.com");
    await page.getByPlaceholder("Answer by typing or speaking...").fill("I coordinated mitigation, rollback, stakeholder updates, and a durable remediation plan.");
    await page.getByRole("button", { name: "Save answer and get follow-up" }).click();

    for (let index = 0; index < followUpQuestions.length; index += 1) {
        await expect(page.getByText(`Follow-up ${index + 1} of up to 3`, { exact: true })).toBeVisible();
        await expect(page.getByText(followUpQuestions[index], { exact: true })).toBeVisible();
        await page.getByLabel("Your follow-up answer").fill(`Evidence for follow-up ${index + 1}`);
        await page.getByRole("button", { name: "Save follow-up and continue interview" }).click();
        if (index < followUpQuestions.length - 1) {
            await expect(page.getByRole("heading", { name: primary.text })).toBeVisible();
        }
    }

    await expect(page.getByText("1 of 1 complete", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit assessment" })).toBeEnabled();
    expect(answerRequests).toBe(4);
    expect(currentQuestion.followUps).toHaveLength(3);
    expect(currentQuestion.followUpNumber).toBe(0);

    await page.getByRole("button", { name: "Submit assessment" }).click();
    await expect(page.getByRole("heading", { name: "Assessment submitted" })).toBeVisible();
});

test("candidate reload restores the saved assessment attempt without starting a second session", async ({ page }) => {
    await mockSignedOut(page);
    const shareToken = "share-recovery";
    const first = { _id: "q1", text: "How do you make deploys safe?", answer: "", followUpNumber: 0, followUps: [] };
    const second = { _id: "q2", text: "How do you validate rollback readiness?", answer: "", followUpNumber: 0, followUps: [] };
    const round = { _id: "round-recovery", name: "Reliability", deliveryMode: "conversational", adaptive: false, questions: [first, second] };
    let startCalls = 0;

    await page.route(`**/api/assessments/public/${shareToken}`, (route) => json(route, {
        title: "Recovery-safe assessment",
        jobRole: "Engineer",
        durationMinutes: 20,
        followUpsEnabled: false,
        rounds: [{ name: round.name, deliveryMode: round.deliveryMode, adaptive: false, questionCount: 2 }],
    }));
    await page.route(`**/api/assessments/public/${shareToken}/start`, (route) => {
        startCalls += 1;
        return json(route, { attemptToken: "recovery-secret", attempt: { _id: "attempt-recovery", rounds: [round] } }, 201);
    });
    await page.route(`**/api/assessments/public/${shareToken}/attempts/attempt-recovery/answer`, async (route) => {
        const body = await route.request().postDataJSON();
        return json(route, {
            attempt: {
                _id: "attempt-recovery",
                rounds: [{ ...round, questions: [{ ...first, answer: body.answer }, second] }],
            },
        });
    });

    await startPublicAssessment(page, shareToken, "Recovery Candidate", "recovery@example.com");
    const savedAnswer = "I use canaries, health gates, automated rollback triggers, and tested runbooks.";
    await page.getByPlaceholder("Answer by typing or speaking...").fill(savedAnswer);
    await page.getByRole("button", { name: "Save answer" }).click();
    await expect(page.getByRole("heading", { name: second.text })).toBeVisible();
    await expect(page.getByText("1 of 2 complete", { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: first.text })).toBeVisible();
    await expect(page.getByPlaceholder("Answer by typing or speaking...")).toHaveValue(savedAnswer);
    await expect(page.getByText("1 of 2 complete", { exact: true })).toBeVisible();
    expect(startCalls).toBe(1);
});

test("recruiter report renders the complete follow-up evidence chain on the canonical Hire route", async ({ page }) => {
    await mockSignedIn(page);
    await page.route("**/api/assessments/report-followups", (route) => json(route, {
        assessment: {
            _id: "report-followups",
            title: "Backend evidence interview",
            status: "active",
            jobRole: "Backend Engineer",
            shareToken: "share-report",
            invitations: [],
            rubric: [{ _id: "rubric-1", name: "Technical judgment", description: "Grounded production decisions", weight: 1 }],
        },
        attempts: [{
            _id: "attempt-report",
            candidateName: "Evidence Candidate",
            candidateEmail: "evidence@example.com",
            status: "submitted",
            startedAt: "2026-09-01T10:00:00Z",
            submittedAt: "2026-09-01T10:30:00Z",
            overallScore: 8.4,
            rounds: [{
                _id: "round-report",
                name: "Technical",
                score: 8.4,
                questions: [{
                    _id: "q-report",
                    text: "How do you secure an API?",
                    answer: "Use scoped authorization, short-lived credentials, rate limits, and audit logs.",
                    score: 8.4,
                    feedbackComment: "Strong grounded evidence",
                    suggestions: [],
                    followUps: [
                        { question: "How do you rotate credentials?", answer: "Automated rotation with short overlap windows." },
                        { question: "How do you detect abuse?", answer: "Rate limits, anomaly signals, and auditable security events." },
                        { question: "What failure mode remains?", answer: "Upstream identity compromise still requires independent detection." },
                    ],
                }],
            }],
        }],
    }));

    await page.goto("/hire/assessments/report-followups");
    await expect(page.getByRole("heading", { name: "Backend evidence interview", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: /Technical/ }).click();
    await expect(page.getByText("AI follow-up 1: How do you rotate credentials?", { exact: true })).toBeVisible();
    await expect(page.getByText("AI follow-up 2: How do you detect abuse?", { exact: true })).toBeVisible();
    await expect(page.getByText("AI follow-up 3: What failure mode remains?", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Preview candidate experience" })).toHaveAttribute("href", "/hire/assessments/report-followups/preview");
});
