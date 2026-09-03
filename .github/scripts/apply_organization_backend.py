from pathlib import Path


def replace(path, old, new, count=1):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise RuntimeError(f"Expected snippet not found in {path}: {old[:140]!r}")
    p.write_text(text.replace(old, new, count))


# Organization controller: no implicit/default organizations.
replace(
    "server/src/controllers/organizationController.js",
    'import User from "../models/User.js";\nimport { ensureDefaultOrganization } from "../middleware/organizationContext.js";\n',
    'import User from "../models/User.js";\n',
)
replace(
    "server/src/controllers/organizationController.js",
    '        await ensureDefaultOrganization(req.user);\n',
    '',
)

# Mount organization API and allow its request header through CORS.
replace(
    "server/src/app.js",
    'import jobPostRoutes from "./routes/jobPostRoutes.js";\n',
    'import jobPostRoutes from "./routes/jobPostRoutes.js";\nimport organizationRoutes from "./routes/organizationRoutes.js";\n',
)
replace(
    "server/src/app.js",
    '                  "X-Attempt-Token",\n',
    '                  "X-Attempt-Token",\n                  "X-Organization-Id",\n',
    count=2,
)
replace(
    "server/src/app.js",
    'app.use("/api/assessments", assessmentRoutes);\n',
    'app.use("/api/organizations", organizationRoutes);\napp.use("/api/assessments", assessmentRoutes);\n',
)

# Protect all recruiter routes once with organization context and apply role checks.
replace(
    "server/src/routes/assessmentRoutes.js",
    'import audit from "../middleware/audit.js";\n',
    'import audit from "../middleware/audit.js";\nimport { organizationContext, requireOrganizationRole } from "../middleware/organizationContext.js";\n',
)
marker = 'router.post("/public/:shareToken/attempts/:attemptId/transcribe", requireFeature("ENABLE_STT"), validate(attemptParams, "params"), protectCandidateTool, quotas({ key: (req) => `assessment-stt:${req.params.attemptId}:${req.ip}`, metricKey: "assessment_stt", windowSeconds: 3600, maxPerWindow: 120 }), uploadAudioMulter.single("audio"), transcribeCandidateAudio);\n\n'
replace(
    "server/src/routes/assessmentRoutes.js",
    marker,
    marker + 'router.use(protect, organizationContext);\n\n',
)

p = Path("server/src/routes/assessmentRoutes.js")
text = p.read_text()
text = text.replace('router.get("/", protect, ', 'router.get("/", ')
text = text.replace('router.get("/overview", protect, ', 'router.get("/overview", ')
text = text.replace('router.get("/:assessmentId", protect, ', 'router.get("/:assessmentId", ')
text = text.replace('router.get("/:assessmentId/preview", protect, ', 'router.get("/:assessmentId/preview", ')
text = text.replace('router.post("/questions/generate", protect, ', 'router.post("/questions/generate", requireOrganizationRole("owner", "admin", "recruiter"), ')
text = text.replace('router.post("/questions/improve", protect, ', 'router.post("/questions/improve", requireOrganizationRole("owner", "admin", "recruiter"), ')
text = text.replace('router.post("/", protect, usageLimit', 'router.post("/", requireOrganizationRole("owner", "admin", "recruiter"), usageLimit')
text = text.replace('router.post("/:assessmentId/duplicate", protect, ', 'router.post("/:assessmentId/duplicate", requireOrganizationRole("owner", "admin", "recruiter"), ')
text = text.replace('router.post("/:assessmentId/invitations", protect, ', 'router.post("/:assessmentId/invitations", requireOrganizationRole("owner", "admin", "recruiter"), ')
text = text.replace('router.delete("/:assessmentId/invitations/:invitationId", protect, ', 'router.delete("/:assessmentId/invitations/:invitationId", requireOrganizationRole("owner", "admin", "recruiter"), ')
text = text.replace('router.patch("/:assessmentId/attempts/:attemptId/review", protect, ', 'router.patch("/:assessmentId/attempts/:attemptId/review", requireOrganizationRole("owner", "admin", "recruiter", "hiring_manager", "reviewer"), ')
text = text.replace('router.patch("/:assessmentId", protect, ', 'router.patch("/:assessmentId", requireOrganizationRole("owner", "admin", "recruiter"), ')
p.write_text(text)

# Assessment controller: organization is the ownership/security boundary.
p = Path("server/src/controllers/assessmentController.js")
text = p.read_text()
text = text.replace('owner: req.user._id, title, company, jobRole, jobDescription, followUpsEnabled, inviteOnly,', 'organization: req.organizationId, createdBy: req.user._id, title, company, jobRole, jobDescription, followUpsEnabled, inviteOnly,')
text = text.replace('const filter = { owner: req.user._id };', 'const filter = { organization: req.organizationId };')
text = text.replace('Assessment.find({ owner: req.user._id })', 'Assessment.find({ organization: req.organizationId })')
text = text.replace('_id: req.params.assessmentId, owner: req.user._id', '_id: req.params.assessmentId, organization: req.organizationId')
text = text.replace('...copy, owner: req.user._id, title:', '...copy, organization: req.organizationId, createdBy: req.user._id, title:')
if 'owner: req.user._id' in text:
    raise RuntimeError('Legacy assessment owner query remains in assessmentController.js')
p.write_text(text)

# E2E journey: create explicit organizations and pass the context header.
replace(
    "server/src/test/e2e/happyFlows.test.js",
    '        const auth = { Authorization: `Bearer ${accessToken}` };\n\n',
    '''        const auth = { Authorization: `Bearer ${accessToken}` };
        const hiringOrganization = await agent.post("/api/organizations")
            .set(auth).set("origin", origin).set("referer", `${origin}/`)
            .send({ name: "Acme Hiring" }).expect(201);
        auth["X-Organization-Id"] = hiringOrganization.body.organization._id;

''',
)
replace(
    "server/src/test/e2e/happyFlows.test.js",
    '        const otherAuth = { Authorization: `Bearer ${signAccessToken(otherUser._id, otherUser.tokenVersion)}` };\n',
    '''        const otherAuth = { Authorization: `Bearer ${signAccessToken(otherUser._id, otherUser.tokenVersion)}` };
        const otherOrganization = await agent.post("/api/organizations")
            .set(otherAuth).set("origin", origin).set("referer", `${origin}/`)
            .send({ name: "Other Hiring Team" }).expect(201);
        otherAuth["X-Organization-Id"] = otherOrganization.body.organization._id;
''',
)
replace(
    "server/src/test/e2e/happyFlows.test.js",
    '        expect(await Assessment.exists({ _id: assessmentId, owner: me._id })).toBeTruthy();',
    '        expect(await Assessment.exists({ _id: assessmentId, organization: hiringOrganization.body.organization._id, createdBy: me._id })).toBeTruthy();',
)

print("Organization backend refactor applied")
