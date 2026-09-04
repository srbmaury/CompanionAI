from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


# Metrics: prompt-purpose and adaptive-engine observability.
replace_once(
    "server/src/metrics/index.js",
    'export const aiInvalidResponsesTotal = new client.Counter({ name: "ai_invalid_responses_total", help: "AI responses that were empty or invalid", labelNames: ["provider", "model"] });\n',
    'export const aiInvalidResponsesTotal = new client.Counter({ name: "ai_invalid_responses_total", help: "AI responses that were empty or invalid", labelNames: ["provider", "model"] });\n'
    'export const aiPurposeRequestsTotal = new client.Counter({ name: "ai_purpose_requests_total", help: "AI requests by stable product purpose and prompt bundle", labelNames: ["provider", "model", "purpose", "promptVersion", "outcome"] });\n'
    'export const adaptiveInterviewEventsTotal = new client.Counter({ name: "adaptive_interview_events_total", help: "Adaptive interviewer state transitions", labelNames: ["event", "action"] });\n'
    'export const adaptiveDifficultyTransitionsTotal = new client.Counter({ name: "adaptive_difficulty_transitions_total", help: "Adaptive interviewer difficulty changes", labelNames: ["from", "to"] });\n'
    'export const adaptiveFallbackQuestionsTotal = new client.Counter({ name: "adaptive_fallback_questions_total", help: "Adaptive questions served from deterministic or grounded fallback paths" });\n'
    'export const adaptiveFollowUpsTotal = new client.Counter({ name: "adaptive_followups_total", help: "Follow-up probes asked inside adaptive Practice rounds" });\n'
    'export const adaptiveRoundQuestions = new client.Histogram({ name: "adaptive_round_questions", help: "Completed base-question count for adaptive Practice rounds", buckets: [1, 2, 3, 4, 5, 6, 8, 10] });\n'
    'export const adaptiveRoundCoverage = new client.Histogram({ name: "adaptive_round_coverage_percent", help: "Final weighted competency coverage for adaptive Practice rounds", buckets: [25, 40, 55, 70, 80, 90, 95, 100] });\n'
)
replace_once(
    "server/src/metrics/index.js",
    '    aiInvalidResponsesTotal,\n',
    '    aiInvalidResponsesTotal,\n'
    '    aiPurposeRequestsTotal,\n'
    '    adaptiveInterviewEventsTotal,\n'
    '    adaptiveDifficultyTransitionsTotal,\n'
    '    adaptiveFallbackQuestionsTotal,\n'
    '    adaptiveFollowUpsTotal,\n'
    '    adaptiveRoundQuestions,\n'
    '    adaptiveRoundCoverage,\n'
)

# AI client: classify stable purposes without storing prompts or responses.
replace_once(
    "server/src/utils/generateQuestions/aiClient.js",
    'dotenv.config();\n\n// Module-level singletons',
    'dotenv.config();\n\nexport const ADAPTIVE_PROMPT_BUNDLE_VERSION = "adaptive-2026-09-v1";\n\n'
    'const classifyPromptPurpose = (prompt) => {\n'
    '    const text = (prompt || "").toString().toLowerCase();\n'
    '    if (text.startsWith("design the evidence plan for one adaptive technical interview round")) return "adaptive_plan";\n'
    '    if (text.startsWith("evaluate one completed technical interview question")) return "adaptive_evaluation";\n'
    '    if (text.startsWith("generate exactly one next question for an adaptive technical interview")) return "adaptive_question";\n'
    '    if (text.startsWith("you are conducting a realistic") && text.includes("follow-up")) return "adaptive_followup";\n'
    '    return "other";\n'
    '};\n\n'
    'const observePurpose = (provider, model, purpose, promptVersion, outcome) => {\n'
    '    try { metrics.aiPurposeRequestsTotal.labels(provider, model, purpose, promptVersion, outcome).inc(); } catch {}\n'
    '};\n\n// Module-level singletons'
)
replace_once(
    "server/src/utils/generateQuestions/aiClient.js",
    '    const trimmed = (prompt || "").toString().slice(0, 16000);\n',
    '    const trimmed = (prompt || "").toString().slice(0, 16000);\n'
    '    const purpose = classifyPromptPurpose(trimmed);\n'
    '    const promptVersion = purpose.startsWith("adaptive_") ? ADAPTIVE_PROMPT_BUNDLE_VERSION : "unversioned";\n'
)
for old, new in [
    ('            metrics.aiRequestsTotal.labels("openai", openAiModel, "success").inc();\n', '            metrics.aiRequestsTotal.labels("openai", openAiModel, "success").inc();\n            observePurpose("openai", openAiModel, purpose, promptVersion, "success");\n'),
    ('        metrics.aiRequestsTotal.labels("openai", openAiModel, "failure").inc();\n', '        metrics.aiRequestsTotal.labels("openai", openAiModel, "failure").inc();\n        observePurpose("openai", openAiModel, purpose, promptVersion, "failure");\n'),
    ('            metrics.aiRequestsTotal.labels("gemini", geminiModel, "success").inc();\n', '            metrics.aiRequestsTotal.labels("gemini", geminiModel, "success").inc();\n            observePurpose("gemini", geminiModel, purpose, promptVersion, "success");\n'),
    ('            metrics.aiRequestsTotal.labels("gemini", geminiModel, "failure").inc();\n', '            metrics.aiRequestsTotal.labels("gemini", geminiModel, "failure").inc();\n            observePurpose("gemini", geminiModel, purpose, promptVersion, "failure");\n'),
]:
    replace_once("server/src/utils/generateQuestions/aiClient.js", old, new)

# Round persistence: stable engine/prompt version plus append-only technical snapshots.
replace_once(
    "server/src/models/Round.js",
    'import mongoose from "mongoose";\n',
    'import mongoose from "mongoose";\nimport AdaptiveInterviewTrace from "./AdaptiveInterviewTrace.js";\nimport metrics from "../metrics/index.js";\n'
)
replace_once(
    "server/src/models/Round.js",
    'const adaptiveStateSchema = new mongoose.Schema({\n    enabled: { type: Boolean, default: false },\n',
    'const adaptiveStateSchema = new mongoose.Schema({\n    enabled: { type: Boolean, default: false },\n'
    '    engineVersion: { type: String, maxlength: 80, default: "adaptive-v1" },\n'
    '    promptVersion: { type: String, maxlength: 80, default: "adaptive-2026-09-v1" },\n'
)
hook = r'''
const coverageOf = (state) => {
    const competencies = Array.isArray(state?.competencies) ? state.competencies : [];
    if (!competencies.length) return 0;
    let weighted = 0;
    let total = 0;
    for (const item of competencies) {
        const weight = Math.max(0.1, Number(item?.weight) || 1);
        const confidence = Math.max(0, Math.min(1, Number(item?.confidence) || 0));
        weighted += weight * Math.min(1, confidence / 0.72);
        total += weight;
    }
    return total ? weighted / total : 0;
};

const averageConfidenceOf = (state) => {
    const competencies = Array.isArray(state?.competencies) ? state.competencies : [];
    if (!competencies.length) return 0;
    return competencies.reduce((sum, item) => sum + Math.max(0, Math.min(1, Number(item?.confidence) || 0)), 0) / competencies.length;
};

const followUpCountOf = (questions) => (questions || []).reduce((sum, item) => sum + (Array.isArray(item?.followUps) ? item.followUps.length : 0), 0);
const comparableDecision = (state) => JSON.stringify({
    action: state?.lastDecision?.action || "",
    targetCompetency: state?.lastDecision?.targetCompetency || "",
    difficulty: Number(state?.lastDecision?.difficulty) || 0,
    reason: state?.lastDecision?.reason || "",
});

roundSchema.pre("save", async function captureAdaptivePrevious() {
    if (!this.adaptiveState?.enabled) return;
    if (!this.isNew && !this.isModified("adaptiveState") && !this.isModified("questions") && !this.isModified("status")) return;
    if (this.isNew) {
        this.$locals.adaptivePrevious = null;
        return;
    }
    this.$locals.adaptivePrevious = await this.constructor.findById(this._id)
        .select("adaptiveState status questions.sourceType questions.sourceClaim questions.followUps")
        .lean();
});

roundSchema.post("save", async function recordAdaptiveTrace(doc) {
    if (!doc.adaptiveState?.enabled) return;
    const previous = this.$locals?.adaptivePrevious || null;
    const beforeState = previous?.adaptiveState || {};
    const afterState = doc.adaptiveState || {};
    const beforeQuestions = previous?.questions || [];
    const afterQuestions = doc.questions || [];
    const beforeFollowUps = followUpCountOf(beforeQuestions);
    const afterFollowUps = followUpCountOf(afterQuestions);
    const beforeAsked = Number(beforeState?.questionsAsked) || 0;
    const afterAsked = Number(afterState?.questionsAsked) || 0;
    const beforeDifficulty = Number(beforeState?.currentDifficulty) || Number(afterState?.currentDifficulty) || 3;
    const afterDifficulty = Number(afterState?.currentDifficulty) || beforeDifficulty;
    const statusChanged = previous?.status !== doc.status;
    const meaningful = !previous
        || beforeQuestions.length !== afterQuestions.length
        || beforeFollowUps !== afterFollowUps
        || beforeAsked !== afterAsked
        || beforeDifficulty !== afterDifficulty
        || statusChanged
        || comparableDecision(beforeState) !== comparableDecision(afterState);
    if (!meaningful) return;

    let eventType = "policy_updated";
    if (!previous || !beforeState?.enabled) eventType = "initialized";
    else if (doc.status === "completed" && previous.status !== "completed") eventType = "completed";
    else if (afterQuestions.length > beforeQuestions.length) eventType = "question_selected";
    else if (afterAsked > beforeAsked) eventType = "evidence_evaluated";
    else if (afterFollowUps > beforeFollowUps) eventType = "follow_up";

    const lastQuestion = afterQuestions[afterQuestions.length - 1] || {};
    const action = afterState?.lastDecision?.action || "";
    const coverageBefore = coverageOf(beforeState);
    const coverageAfter = coverageOf(afterState);
    const trace = {
        round: doc._id,
        eventType,
        action,
        targetCompetency: afterState?.lastDecision?.targetCompetency || "",
        sourceType: lastQuestion?.sourceType || "",
        usedResumeClaim: Boolean(lastQuestion?.sourceClaim) || lastQuestion?.sourceType === "resume-claim",
        fallbackUsed: lastQuestion?.sourceType === "fallback",
        questionCount: afterQuestions.length,
        questionsAsked: afterAsked,
        followUpCount: afterFollowUps,
        difficultyFrom: beforeDifficulty,
        difficultyTo: afterDifficulty,
        coverageBefore,
        coverageAfter,
        averageConfidenceBefore: averageConfidenceOf(beforeState),
        averageConfidenceAfter: averageConfidenceOf(afterState),
        engineVersion: afterState?.engineVersion || "adaptive-v1",
        promptVersion: afterState?.promptVersion || "adaptive-2026-09-v1",
        reason: afterState?.lastDecision?.reason || afterState?.completedReason || "",
    };

    try {
        await AdaptiveInterviewTrace.create(trace);
        metrics.adaptiveInterviewEventsTotal.labels(eventType, action || "none").inc();
        if (beforeDifficulty !== afterDifficulty) metrics.adaptiveDifficultyTransitionsTotal.labels(String(beforeDifficulty), String(afterDifficulty)).inc();
        if (trace.fallbackUsed && eventType === "question_selected") metrics.adaptiveFallbackQuestionsTotal.inc();
        if (afterFollowUps > beforeFollowUps) metrics.adaptiveFollowUpsTotal.inc(afterFollowUps - beforeFollowUps);
        if (eventType === "completed") {
            metrics.adaptiveRoundQuestions.observe(afterAsked || afterQuestions.length);
            metrics.adaptiveRoundCoverage.observe(Math.round(coverageAfter * 1000) / 10);
        }
    } catch (error) {
        console.warn("adaptive trace persistence failed", error?.message || error);
    }
});

'''
replace_once(
    "server/src/models/Round.js",
    'const Round = mongoose.model("Round", roundSchema);\n',
    hook + 'const Round = mongoose.model("Round", roundSchema);\n'
)

# Admin calibration API.
replace_once(
    "server/src/routes/adminRoutes.js",
    'import { ObjectIdString } from "../validation/commonSchemas.js";\n',
    'import { ObjectIdString } from "../validation/commonSchemas.js";\nimport { getCalibrationSnapshot } from "../services/calibrationAnalytics.js";\n'
)
needle = 'router.get(\n    "/audit",\n'
route = '''router.get(
    "/calibration",
    protect,
    requireRole("admin"),
    validate(z.object({ limit: z.coerce.number().int().min(50).max(2000).optional() }), "query"),
    async (req, res, next) => {
        try {
            return res.json(await getCalibrationSnapshot({ limit: req.query.limit }));
        } catch (error) { return next(error); }
    }
);

router.get(
    "/audit",
'''
replace_once("server/src/routes/adminRoutes.js", needle, route)

# Client route and admin navigation.
replace_once(
    "client/src/App.jsx",
    'const AdminAuditPage = lazy(() => import("./pages/AdminAuditPage.jsx"));\n',
    'const AdminAuditPage = lazy(() => import("./pages/AdminAuditPage.jsx"));\nconst AdminCalibrationPage = lazy(() => import("./pages/AdminCalibrationPage.jsx"));\n'
)
replace_once(
    "client/src/App.jsx",
    '                <Route path="/admin/audit" element={<ProtectedRoute><AdminRoute><AdminAuditPage /></AdminRoute></ProtectedRoute>} />\n',
    '                <Route path="/admin/audit" element={<ProtectedRoute><AdminRoute><AdminAuditPage /></AdminRoute></ProtectedRoute>} />\n'
    '                <Route path="/admin/calibration" element={<ProtectedRoute><AdminRoute><AdminCalibrationPage /></AdminRoute></ProtectedRoute>} />\n'
)
replace_once(
    "client/src/components/Header.jsx",
    '                                    {user?.role === "admin" && <MenuItem component={RouterLink} to="/admin/audit" onClick={() => setProfileAnchor(null)}>Audit activity</MenuItem>}\n',
    '                                    {user?.role === "admin" && <MenuItem component={RouterLink} to="/admin/audit" onClick={() => setProfileAnchor(null)}>Audit activity</MenuItem>}\n'
    '                                    {user?.role === "admin" && <MenuItem component={RouterLink} to="/admin/calibration" onClick={() => setProfileAnchor(null)}>AI calibration</MenuItem>}\n'
)
replace_once(
    "client/src/components/Header.jsx",
    '                                {user?.role === "admin" && <MenuItem component={RouterLink} to="/admin/audit" onClick={close}>Audit activity</MenuItem>}\n',
    '                                {user?.role === "admin" && <MenuItem component={RouterLink} to="/admin/audit" onClick={close}>Audit activity</MenuItem>}\n'
    '                                {user?.role === "admin" && <MenuItem component={RouterLink} to="/admin/calibration" onClick={close}>AI calibration</MenuItem>}\n'
)

print("Calibration integration patch applied")
