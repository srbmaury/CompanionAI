import { useContext, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
    AddRounded,
    ArrowBackRounded,
    ArrowForwardRounded,
    AutoAwesomeRounded,
    CheckCircleRounded,
    DeleteOutlineRounded,
    EditRounded,
    ScheduleRounded,
    SendRounded,
} from "@mui/icons-material";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    CircularProgress,
    Collapse,
    Container,
    Divider,
    FormControlLabel,
    IconButton,
    MenuItem,
    Paper,
    Stack,
    Step,
    StepLabel,
    Stepper,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from "@mui/material";
import api from "../api/axios";
import JobPostImporter from "../components/JobPostImporter";
import { OrganizationContext } from "../context/OrganizationContext";
import { useNotify } from "../context/NotificationContext";
import { assessQuestionSet } from "../utils/assessmentQuality";
import {
    ASSESSMENT_WIZARD_STEPS,
    assessmentStepIssue,
    normalizeAssessmentRounds,
    parseCandidateEmails,
    publishReadinessIssue,
} from "../utils/assessmentWizard";
import { hiringPermissionsFor } from "../utils/hiringPermissions";
import { storage } from "../utils/interviewStorage";
import { trackEvent } from "../utils/analytics";

const experienceNames = {
    conversational: "Technical interview",
    "online-assessment": "Coding / written",
    "system-design": "System design",
};

const emptyRound = () => ({
    name: "Technical interview",
    description: "Role-specific knowledge, practical judgment, and communication",
    deliveryMode: "conversational",
    adaptive: true,
    questionCount: 3,
    aiPrompt: "",
    questions: [],
});

const initialForm = () => ({
    title: "",
    jobRole: "",
    jobDescription: "",
    candidateInstructions: "",
    contactEmail: "",
    durationMinutes: 30,
    opensAt: "",
    expiresAt: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    followUpsEnabled: true,
    inviteOnly: false,
    inviteEmails: "",
    templateName: "",
    rubric: [],
    integrity: {
        enabled: false,
        requireFullscreen: false,
        trackFocus: true,
        trackClipboard: true,
        requireCamera: false,
        monitorFacePresence: false,
        retentionDays: 30,
    },
    rounds: [emptyRound()],
});

const STARTERS = {
    engineering: {
        title: "Software Engineer Assessment",
        jobRole: "Software Engineer",
        jobDescription: "Build reliable, secure, maintainable software; reason about APIs, data, testing, scalability, observability, and production tradeoffs; communicate decisions clearly.",
        round: { name: "Technical interview", description: "Problem solving, engineering judgment, reliability, and tradeoffs" },
    },
    product: {
        title: "Product Manager Assessment",
        jobRole: "Product Manager",
        jobDescription: "Discover customer needs, prioritize outcomes, define success metrics, reason through product tradeoffs, and align cross-functional teams through ambiguity.",
        round: { name: "Product sense", description: "Discovery, prioritization, metrics, and stakeholder judgment" },
    },
    sales: {
        title: "Account Executive Assessment",
        jobRole: "Account Executive",
        jobDescription: "Qualify opportunities, uncover customer value, handle objections, communicate clearly, and run a structured, ethical sales process from discovery through close.",
        round: { name: "Customer conversation", description: "Discovery, value articulation, objections, and closing judgment" },
    },
};

const defaultPromptFor = (round) => {
    if (round.deliveryMode === "system-design") {
        return "Create one realistic system-design prompt for this role. Require the candidate to clarify requirements, propose APIs and data models, reason about scale and reliability, and discuss tradeoffs.";
    }
    if (round.deliveryMode === "online-assessment") {
        return "Create practical coding or written questions that test the most important skills and seniority in the job description. Prefer realistic tasks over trivia.";
    }
    return "Create high-signal, scenario-based interview questions for this role. Test practical judgment, depth, tradeoffs, and communication rather than trivia.";
};

const hydrateAssessment = (assessment) => ({
    ...initialForm(),
    title: assessment.title || "",
    jobRole: assessment.jobRole || "",
    jobDescription: assessment.jobDescription || "",
    candidateInstructions: assessment.candidateInstructions || "",
    contactEmail: assessment.contactEmail || "",
    durationMinutes: assessment.durationMinutes || 30,
    opensAt: assessment.opensAt ? new Date(assessment.opensAt).toISOString().slice(0, 16) : "",
    expiresAt: assessment.expiresAt ? new Date(assessment.expiresAt).toISOString().slice(0, 16) : "",
    timezone: assessment.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    followUpsEnabled: assessment.followUpsEnabled !== false,
    inviteOnly: Boolean(assessment.inviteOnly),
    inviteEmails: assessment.invitations?.filter((item) => item.status !== "revoked").map((item) => item.email).join("\n") || "",
    templateName: assessment.templateName || "",
    rubric: assessment.rubric || [],
    integrity: { ...initialForm().integrity, ...(assessment.integrity || {}) },
    rounds: assessment.rounds?.length ? assessment.rounds.map((round) => ({
        ...round,
        adaptive: round.deliveryMode === "conversational" ? round.adaptive !== false : false,
        aiPrompt: "",
        questionCount: round.questionCount || round.questions?.length || 1,
        questions: round.questions || [],
    })) : [emptyRound()],
});

export default function CreateAssessmentPage() {
    const navigate = useNavigate();
    const notify = useNotify();
    const [searchParams] = useSearchParams();
    const editId = searchParams.get("edit") || "";
    const { activeOrganization, currentRole, loading: organizationLoading } = useContext(OrganizationContext);
    const { canManageAssessments } = hiringPermissionsFor(currentRole);
    const [form, setForm] = useState(initialForm);
    const [activeStep, setActiveStep] = useState(0);
    const [titleCustomized, setTitleCustomized] = useState(false);
    const [generatingRound, setGeneratingRound] = useState(null);
    const [improvingQuestion, setImprovingQuestion] = useState("");
    const [saving, setSaving] = useState(false);
    const [loadingDraft, setLoadingDraft] = useState(Boolean(editId));
    const [error, setError] = useState("");
    const [draftReady, setDraftReady] = useState(false);

    const draftKey = useMemo(
        () => activeOrganization?._id ? `ia:hiring-assessment:${activeOrganization._id}:${editId || "new"}` : "",
        [activeOrganization?._id, editId],
    );
    const assessmentQuality = useMemo(() => assessQuestionSet(form), [form]);
    const inviteEmails = useMemo(() => parseCandidateEmails(form.inviteEmails), [form.inviteEmails]);
    const readinessIssue = useMemo(() => publishReadinessIssue(form), [form]);

    useEffect(() => {
        if (!draftKey) return;
        let active = true;
        const saved = storage.get(draftKey);

        if (!editId) {
            if (saved?.form) {
                setForm(saved.form);
                setActiveStep(Math.min(Number(saved.activeStep) || 0, ASSESSMENT_WIZARD_STEPS.length - 1));
                setTitleCustomized(Boolean(saved.titleCustomized));
            }
            setDraftReady(true);
            return;
        }

        setLoadingDraft(true);
        api.get(`/assessments/${editId}`).then(({ data }) => {
            if (!active) return;
            if (data.assessment?.status !== "draft" || data.attempts?.length) {
                setError("Only unused draft assessments can be edited.");
                return;
            }
            const serverForm = hydrateAssessment(data.assessment);
            setForm(saved?.form || serverForm);
            setActiveStep(Math.min(Number(saved?.activeStep) || 0, ASSESSMENT_WIZARD_STEPS.length - 1));
            setTitleCustomized(saved?.titleCustomized ?? true);
        }).catch(() => {
            if (active) setError("This draft could not be loaded for editing.");
        }).finally(() => {
            if (active) {
                setLoadingDraft(false);
                setDraftReady(true);
            }
        });

        return () => { active = false; };
    }, [draftKey, editId]);

    useEffect(() => {
        if (!draftReady || !draftKey) return;
        storage.set(draftKey, { form, activeStep, titleCustomized });
    }, [activeStep, draftKey, draftReady, form, titleCustomized]);

    useEffect(() => {
        trackEvent(editId ? "assessment_wizard_edit_started" : "assessment_wizard_started");
    }, [editId]);

    const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
    const setJobRole = (value) => setForm((current) => ({
        ...current,
        jobRole: value,
        ...(!titleCustomized ? { title: value ? `${value} Assessment` : "" } : {}),
    }));

    const applyStarter = (key) => {
        const starter = STARTERS[key];
        if (!starter) return;
        setTitleCustomized(false);
        setForm((current) => ({
            ...current,
            title: starter.title,
            jobRole: starter.jobRole,
            jobDescription: starter.jobDescription,
            rounds: [{ ...emptyRound(), ...starter.round }],
        }));
    };

    const updateRound = (index, key, value) => setForm((current) => ({
        ...current,
        rounds: current.rounds.map((round, position) => {
            if (position !== index) return round;
            if (key === "deliveryMode") {
                return {
                    ...round,
                    name: experienceNames[value] || round.name,
                    deliveryMode: value,
                    adaptive: value === "conversational" ? round.adaptive !== false : false,
                    questionCount: value === "system-design" ? 1 : Math.max(Number(round.questionCount) || 3, 1),
                };
            }
            if (key === "adaptive") {
                const configuredCount = round.questions.filter((question) => question.text?.trim()).length;
                return {
                    ...round,
                    adaptive: Boolean(value),
                    questionCount: value
                        ? Math.min(10, Math.max(Number(round.questionCount) || 3, configuredCount || 1))
                        : Math.max(configuredCount, 1),
                };
            }
            if (key === "questionCount") {
                const requiredCount = round.questions.filter((question) => question.required && question.text?.trim()).length;
                return { ...round, questionCount: Math.min(10, Math.max(Number(value) || 1, requiredCount || 1)) };
            }
            return { ...round, [key]: value };
        }),
    }));

    const updateQuestion = (roundIndex, questionIndex, patch) => setForm((current) => ({
        ...current,
        rounds: current.rounds.map((round, position) => position === roundIndex
            ? { ...round, questions: round.questions.map((question, qPosition) => qPosition === questionIndex ? { ...question, ...patch } : question) }
            : round),
    }));

    const addQuestion = (roundIndex) => setForm((current) => ({
        ...current,
        rounds: current.rounds.map((round, position) => {
            if (position !== roundIndex) return round;
            const questions = [...round.questions, { text: "", required: true, weight: 1, competencies: [], knockout: false }];
            return {
                ...round,
                questions,
                questionCount: round.deliveryMode === "conversational" && round.adaptive === false
                    ? questions.length
                    : Math.max(Number(round.questionCount) || 1, questions.length),
            };
        }),
    }));

    const removeQuestion = (roundIndex, questionIndex) => setForm((current) => ({
        ...current,
        rounds: current.rounds.map((round, position) => {
            if (position !== roundIndex) return round;
            const questions = round.questions.filter((_, qPosition) => qPosition !== questionIndex);
            return {
                ...round,
                questions,
                questionCount: round.deliveryMode === "conversational" && round.adaptive === false
                    ? Math.max(questions.length, 1)
                    : round.questionCount,
            };
        }),
    }));

    const generateQuestions = async (roundIndex) => {
        const round = form.rounds[roundIndex];
        const existing = round.questions.filter((question) => question.text?.trim());
        const targetCount = round.deliveryMode === "system-design" ? 1 : Math.min(10, Math.max(Number(round.questionCount) || 3, existing.length || 1));
        const remaining = Math.max(targetCount - existing.length, 1);
        setGeneratingRound(roundIndex);
        setError("");
        try {
            const { data } = await api.post("/assessments/questions/generate", {
                jobRole: form.jobRole,
                jobDescription: form.jobDescription,
                roundName: round.name,
                roundDescription: round.description,
                deliveryMode: round.deliveryMode,
                prompt: round.aiPrompt.trim() || defaultPromptFor(round),
                count: remaining,
                existingQuestions: existing.map((question) => question.text),
            });
            const generated = (data.questions || []).map((question) => ({
                ...question,
                required: false,
                weight: Number(question.weight) || 1,
                competencies: question.competencies || [],
                knockout: Boolean(question.knockout),
            }));
            const questions = [...existing, ...generated].slice(0, targetCount);
            setForm((current) => ({
                ...current,
                rounds: current.rounds.map((item, position) => position === roundIndex ? { ...item, questions } : item),
            }));
            notify(`${questions.length} question${questions.length === 1 ? "" : "s"} ready to review.`, "success");
        } catch (err) {
            setError(err?.response?.data?.message || "Questions could not be generated right now. You can add them manually.");
        } finally {
            setGeneratingRound(null);
        }
    };

    const improveQuestion = async (roundIndex, questionIndex) => {
        const question = form.rounds[roundIndex].questions[questionIndex];
        if (!question.text?.trim()) return;
        const key = `${roundIndex}-${questionIndex}`;
        setImprovingQuestion(key);
        try {
            const { data } = await api.post("/assessments/questions/improve", {
                question: question.text,
                jobRole: form.jobRole,
                jobDescription: form.jobDescription,
                roundName: form.rounds[roundIndex].name,
            });
            updateQuestion(roundIndex, questionIndex, { text: data.text });
        } catch (err) {
            notify(err?.response?.data?.message || "This question could not be improved right now.", "error");
        } finally {
            setImprovingQuestion("");
        }
    };

    const moveToStep = (nextStep) => {
        if (nextStep > activeStep) {
            const issue = assessmentStepIssue(form, ASSESSMENT_WIZARD_STEPS[activeStep].key);
            if (issue) {
                setError(issue);
                return;
            }
        }
        setError("");
        setActiveStep(nextStep);
        window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
        trackEvent("assessment_wizard_step_viewed", { step: ASSESSMENT_WIZARD_STEPS[nextStep].key });
    };

    const saveAssessment = async (intent) => {
        if (!canManageAssessments) return;
        const publishNow = intent === "publish";
        const schedule = intent === "schedule";
        const requiredIssue = publishNow || schedule
            ? publishReadinessIssue(form)
            : assessmentStepIssue(form, "role") || assessmentStepIssue(form, "plan") || assessmentStepIssue(form, "candidate");
        if (requiredIssue) {
            setError(requiredIssue);
            return;
        }
        if (schedule && (!form.opensAt || new Date(form.opensAt) <= new Date())) {
            setError("Choose a future opening time before scheduling.");
            return;
        }

        setSaving(true);
        setError("");
        try {
            const rounds = normalizeAssessmentRounds(form.rounds);
            const targetStatus = publishNow ? "active" : schedule ? "scheduled" : "draft";
            const payload = {
                title: form.title.trim(),
                jobRole: form.jobRole.trim(),
                jobDescription: form.jobDescription.trim(),
                candidateInstructions: form.candidateInstructions,
                contactEmail: form.contactEmail,
                durationMinutes: Number(form.durationMinutes) || 30,
                opensAt: form.opensAt ? new Date(form.opensAt).toISOString() : null,
                expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
                timezone: form.timezone,
                followUpsEnabled: form.followUpsEnabled,
                inviteOnly: form.inviteOnly,
                templateName: form.templateName,
                rubric: form.rubric,
                integrity: form.integrity,
                rounds,
            };

            let saved;
            if (editId) {
                const response = await api.patch(`/assessments/${editId}`, payload);
                saved = response.data;
                if (targetStatus !== "draft") {
                    saved = (await api.patch(`/assessments/${editId}`, { status: targetStatus })).data;
                }
            } else {
                saved = (await api.post("/assessments", { ...payload, status: targetStatus })).data;
            }

            let invitationMessage = "";
            if ((publishNow || schedule) && inviteEmails.length) {
                const { data: invitationResult } = await api.post(`/assessments/${saved._id}/invitations`, {
                    candidates: inviteEmails.map((email) => ({ email })),
                });
                const sent = invitationResult.results?.filter((item) => item.sent).length || 0;
                const queued = invitationResult.results?.filter((item) => item.queued).length || 0;
                invitationMessage = sent
                    ? ` ${sent}/${inviteEmails.length} invitation email(s) sent.`
                    : queued
                        ? ` ${queued} invitation(s) queued.`
                        : "";
            }

            if (draftKey) storage.remove(draftKey);
            trackEvent(publishNow ? "assessment_published" : schedule ? "assessment_scheduled" : "assessment_draft_saved");
            const notice = publishNow
                ? `Assessment published.${invitationMessage}`
                : schedule
                    ? `Assessment scheduled.${invitationMessage}`
                    : "Draft saved. Preview it before publishing.";
            navigate(`/hire/assessments/${saved._id}`, { replace: true, state: { notice } });
        } catch (err) {
            setError(err?.response?.data?.message || "The assessment could not be saved. Check the details and try again.");
        } finally {
            setSaving(false);
        }
    };

    if (organizationLoading || loadingDraft) {
        return <Stack minHeight="55vh" alignItems="center" justifyContent="center"><CircularProgress /></Stack>;
    }
    if (!activeOrganization) return <Navigate to="/hire/team" replace />;
    if (!canManageAssessments) return <Navigate to="/hire/assessments#candidate-pipeline" replace />;

    const stepKey = ASSESSMENT_WIZARD_STEPS[activeStep].key;
    const currentStepIssue = assessmentStepIssue(form, stepKey);

    return (
        <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "flex-start" }} gap={2} mb={3}>
                <Box>
                    <Button component={RouterLink} to="/hire/assessments#assessment-list" color="inherit" startIcon={<ArrowBackRounded />} sx={{ px: 0, mb: 1 }}>
                        Back to assessments
                    </Button>
                    <Typography variant="overline" color="primary.main" fontWeight={850}>Evalcue AI Hire</Typography>
                    <Typography component="h1" variant="h3" sx={{ fontSize: { xs: "2.25rem", sm: "2.75rem" } }} fontWeight={850} letterSpacing="-.035em">
                        {editId ? "Edit assessment" : "Create an assessment"}
                    </Typography>
                    <Typography color="text.secondary" mt={1}>Four focused steps. Start with the role; advanced controls stay out of the way until you need them.</Typography>
                </Box>
                <Chip icon={<CheckCircleRounded />} label="Progress saves in this browser" variant="outlined" sx={{ alignSelf: { sm: "flex-start" } }} />
            </Stack>

            <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, mb: 3, borderRadius: 3 }}>
                <Stepper activeStep={activeStep} alternativeLabel sx={{ "& .MuiStepLabel-label": { fontSize: { xs: ".72rem", sm: ".85rem" }, mt: .5 } }}>
                    {ASSESSMENT_WIZARD_STEPS.map((step, index) => (
                        <Step key={step.key} completed={index < activeStep}>
                            <StepLabel>{step.label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>
            </Paper>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

            <Paper variant="outlined" sx={{ p: { xs: 2.25, sm: 3.5 }, borderRadius: 4 }}>
                {stepKey === "role" && <Stack spacing={2.25}>
                    <Box>
                        <Typography variant="overline" color="primary.main" fontWeight={850}>Step 1</Typography>
                        <Typography component="h2" variant="h5" fontWeight={850}>What role are you hiring for?</Typography>
                        <Typography color="text.secondary" mt={.5}>This context drives the interview plan and question generation. You can edit everything later.</Typography>
                    </Box>

                    <Box>
                        <Typography variant="body2" fontWeight={800} mb={1}>Quick starts</Typography>
                        <Stack direction={{ xs: "column", sm: "row" }} gap={1}>
                            <Button variant="outlined" onClick={() => applyStarter("engineering")}>Engineering</Button>
                            <Button variant="outlined" onClick={() => applyStarter("product")}>Product</Button>
                            <Button variant="outlined" onClick={() => applyStarter("sales")}>Sales</Button>
                        </Stack>
                    </Box>

                    <JobPostImporter onImport={({ jobRole, jobDescription }) => {
                        setTitleCustomized(false);
                        setForm((current) => ({ ...current, jobRole, jobDescription, title: jobRole ? `${jobRole} Assessment` : current.title }));
                    }} />

                    <Paper variant="outlined" sx={{ p: 2, bgcolor: "action.hover" }}>
                        <Typography variant="caption" color="text.secondary">Creating for</Typography>
                        <Typography fontWeight={850}>{activeOrganization.name}</Typography>
                    </Paper>

                    <TextField required fullWidth label="Job role" value={form.jobRole} onChange={(event) => setJobRole(event.target.value)} placeholder="Senior Backend Engineer" />
                    <TextField required fullWidth label="Assessment name" value={form.title} onChange={(event) => { setTitleCustomized(true); setField("title", event.target.value); }} helperText="Candidates will see this name. We generate it from the role by default." />
                    <TextField required fullWidth multiline minRows={5} label="Job description and success criteria" value={form.jobDescription} onChange={(event) => setField("jobDescription", event.target.value)} helperText="Include seniority, must-have skills, responsibilities, and what strong performance looks like." inputProps={{ minLength: 20 }} />
                </Stack>}

                {stepKey === "plan" && <Stack spacing={2.5}>
                    <Box>
                        <Typography variant="overline" color="primary.main" fontWeight={850}>Step 2</Typography>
                        <Typography component="h2" variant="h5" fontWeight={850}>Build the interview plan</Typography>
                        <Typography color="text.secondary" mt={.5}>Choose the candidate experience, then generate or review the questions. Defaults are designed to be usable without touching advanced settings.</Typography>
                    </Box>

                    {form.rounds.map((round, roundIndex) => (
                        <Card variant="outlined" key={roundIndex} sx={{ borderRadius: 3 }}>
                            <CardContent sx={{ p: { xs: 2, sm: 2.75 }, "&:last-child": { pb: { xs: 2, sm: 2.75 } } }}>
                                <Stack spacing={2.25}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                                        <Box>
                                            <Typography variant="overline" color="text.secondary" fontWeight={800}>Round {roundIndex + 1}</Typography>
                                            <Typography component="h3" variant="h6" fontWeight={850}>{round.name}</Typography>
                                        </Box>
                                        {form.rounds.length > 1 && <Tooltip title="Remove round"><IconButton aria-label={`Remove ${round.name} round`} onClick={() => setField("rounds", form.rounds.filter((_, index) => index !== roundIndex))}><DeleteOutlineRounded /></IconButton></Tooltip>}
                                    </Stack>

                                    <Box>
                                        <Typography variant="body2" fontWeight={800} mb={1}>Candidate experience</Typography>
                                        <ToggleButtonGroup exclusive fullWidth value={round.deliveryMode} onChange={(_, value) => value && updateRound(roundIndex, "deliveryMode", value)} size="small">
                                            <ToggleButton value="conversational">Interview</ToggleButton>
                                            <ToggleButton value="online-assessment">Coding / written</ToggleButton>
                                            <ToggleButton value="system-design">System design</ToggleButton>
                                        </ToggleButtonGroup>
                                    </Box>

                                    <Stack direction={{ xs: "column", sm: "row" }} gap={1.5}>
                                        {form.rounds.length > 1 && <TextField required fullWidth label="Round name" value={round.name} onChange={(event) => updateRound(roundIndex, "name", event.target.value)} />}
                                        <TextField
                                            fullWidth
                                            type="number"
                                            label={round.deliveryMode === "conversational" && round.adaptive !== false ? "Maximum primary questions" : "Question count"}
                                            value={round.questionCount}
                                            disabled={round.deliveryMode === "system-design" || (round.deliveryMode === "conversational" && round.adaptive === false)}
                                            onChange={(event) => updateRound(roundIndex, "questionCount", event.target.value)}
                                            inputProps={{ min: 1, max: 10 }}
                                        />
                                    </Stack>
                                    <TextField fullWidth multiline minRows={2} label="What should this round evaluate?" value={round.description} onChange={(event) => updateRound(roundIndex, "description", event.target.value)} />

                                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, bgcolor: "action.hover" }}>
                                        <Stack spacing={1.5}>
                                            <Box>
                                                <Typography fontWeight={850}>Generate a strong starting set</Typography>
                                                <Typography variant="body2" color="text.secondary">AI uses the job context above. Add a brief only when you want to steer the topics or difficulty.</Typography>
                                            </Box>
                                            <TextField fullWidth multiline minRows={2} label="Optional AI brief" value={round.aiPrompt} onChange={(event) => updateRound(roundIndex, "aiPrompt", event.target.value)} placeholder={defaultPromptFor(round)} />
                                            <Button variant="contained" startIcon={generatingRound === roundIndex ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeRounded />} disabled={generatingRound !== null} onClick={() => generateQuestions(roundIndex)}>
                                                {generatingRound === roundIndex ? "Generating…" : round.questions.some((question) => question.text?.trim()) ? "Generate remaining questions" : "Generate suggested questions"}
                                            </Button>
                                        </Stack>
                                    </Paper>

                                    {!round.questions.length && <Paper variant="outlined" sx={{ p: 3, textAlign: "center", borderStyle: "dashed" }}>
                                        <Typography fontWeight={800}>No questions yet</Typography>
                                        <Typography variant="body2" color="text.secondary" mt={.5}>Generate a starting set above, or add your first question manually.</Typography>
                                    </Paper>}

                                    <Stack spacing={1.5}>
                                        {round.questions.map((question, questionIndex) => (
                                            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5 }} key={questionIndex}>
                                                <Stack spacing={1.25}>
                                                    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                                                        <Chip size="small" variant="outlined" label={`Question ${questionIndex + 1}`} />
                                                        <Stack direction="row" spacing={.25}>
                                                            <Tooltip title="Improve with AI"><span><IconButton size="small" aria-label={`Improve question ${questionIndex + 1} with AI`} disabled={!question.text?.trim() || Boolean(improvingQuestion)} onClick={() => improveQuestion(roundIndex, questionIndex)}>{improvingQuestion === `${roundIndex}-${questionIndex}` ? <CircularProgress size={18} /> : <AutoAwesomeRounded fontSize="small" />}</IconButton></span></Tooltip>
                                                            <Tooltip title="Delete question"><IconButton size="small" aria-label={`Delete question ${questionIndex + 1}`} onClick={() => removeQuestion(roundIndex, questionIndex)}><DeleteOutlineRounded fontSize="small" /></IconButton></Tooltip>
                                                        </Stack>
                                                    </Stack>
                                                    <TextField required fullWidth multiline minRows={2} label={`Question ${questionIndex + 1}`} value={question.text || ""} onChange={(event) => updateQuestion(roundIndex, questionIndex, { text: event.target.value })} />
                                                    {round.deliveryMode === "conversational" && round.adaptive !== false && <FormControlLabel control={<Checkbox checked={Boolean(question.required)} onChange={(event) => updateQuestion(roundIndex, questionIndex, { required: event.target.checked })} />} label="Must ask this reviewed question" />}
                                                    <Box component="details" sx={{ "& > summary": { cursor: "pointer", color: "text.secondary", fontWeight: 700, fontSize: ".85rem" } }}>
                                                        <Typography component="summary">Advanced scoring</Typography>
                                                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} mt={1.5}>
                                                            <TextField type="number" label="Weight" value={question.weight || 1} onChange={(event) => updateQuestion(roundIndex, questionIndex, { weight: event.target.value })} inputProps={{ min: .1, max: 10, step: .1 }} sx={{ width: { sm: 120 } }} />
                                                            <TextField fullWidth label="Competencies" value={(question.competencies || []).join(", ")} onChange={(event) => updateQuestion(roundIndex, questionIndex, { competencies: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} helperText="For example: scalability, communication" />
                                                        </Stack>
                                                        <FormControlLabel sx={{ mt: 1 }} control={<Checkbox checked={Boolean(question.knockout)} onChange={(event) => updateQuestion(roundIndex, questionIndex, { knockout: event.target.checked })} />} label="Flag as knockout criterion for human review" />
                                                    </Box>
                                                </Stack>
                                            </Paper>
                                        ))}
                                    </Stack>

                                    <Button variant="outlined" startIcon={<AddRounded />} disabled={round.questions.length >= 10} onClick={() => addQuestion(roundIndex)}>Add manual question</Button>

                                    {round.deliveryMode === "conversational" && <Box component="details" sx={{ "& > summary": { cursor: "pointer", fontWeight: 800 } }}>
                                        <Typography component="summary">Advanced interview behavior</Typography>
                                        <Stack spacing={1.25} mt={1.5}>
                                            <FormControlLabel control={<Checkbox checked={round.adaptive !== false} onChange={(event) => updateRound(roundIndex, "adaptive", event.target.checked)} />} label="Allow AI to choose additional primary questions within the question budget" />
                                            <Typography variant="body2" color="text.secondary">Turn this off when every primary question must come from your reviewed list.</Typography>
                                        </Stack>
                                    </Box>}
                                </Stack>
                            </CardContent>
                        </Card>
                    ))}

                    <Button variant="outlined" startIcon={<AddRounded />} disabled={form.rounds.length >= 5} onClick={() => setField("rounds", [...form.rounds, emptyRound()])}>Add another round</Button>

                    <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3 }}>
                        <FormControlLabel sx={{ m: 0, alignItems: "flex-start" }} control={<Checkbox checked={form.followUpsEnabled} onChange={(event) => setField("followUpsEnabled", event.target.checked)} />} label={<Box pt={.2}><Typography fontWeight={850}>Contextual AI follow-ups</Typography><Typography variant="body2" color="text.secondary">For conversational rounds, AI may ask 0–3 focused probes when an answer needs more evidence. This is on by default.</Typography></Box>} />
                    </Paper>

                    <Box component="details" sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 2, "& > summary": { cursor: "pointer", fontWeight: 850 } }}>
                        <Typography component="summary">Optional scorecard</Typography>
                        <Typography variant="body2" color="text.secondary" mt={1}>Add shared criteria when reviewers need a consistent evidence framework across candidates.</Typography>
                        <Stack spacing={1.5} mt={2}>
                            {form.rubric.map((criterion, index) => <Stack direction={{ xs: "column", sm: "row" }} gap={1} key={index}>
                                <TextField fullWidth label="Criterion" value={criterion.name || ""} onChange={(event) => setField("rubric", form.rubric.map((item, position) => position === index ? { ...item, name: event.target.value } : item))} />
                                <TextField fullWidth label="Evidence description" value={criterion.description || ""} onChange={(event) => setField("rubric", form.rubric.map((item, position) => position === index ? { ...item, description: event.target.value } : item))} />
                                <TextField type="number" label="Weight" value={criterion.weight || 1} onChange={(event) => setField("rubric", form.rubric.map((item, position) => position === index ? { ...item, weight: event.target.value } : item))} sx={{ width: { sm: 110 } }} />
                                <IconButton aria-label="Remove scorecard criterion" onClick={() => setField("rubric", form.rubric.filter((_, position) => position !== index))}><DeleteOutlineRounded /></IconButton>
                            </Stack>)}
                            <Button startIcon={<AddRounded />} sx={{ alignSelf: "flex-start" }} onClick={() => setField("rubric", [...form.rubric, { name: "", description: "", weight: 1 }])}>Add criterion</Button>
                        </Stack>
                    </Box>
                </Stack>}

                {stepKey === "candidate" && <Stack spacing={2.5}>
                    <Box>
                        <Typography variant="overline" color="primary.main" fontWeight={850}>Step 3</Typography>
                        <Typography component="h2" variant="h5" fontWeight={850}>Set up the candidate experience</Typography>
                        <Typography color="text.secondary" mt={.5}>The default is a shareable 30-minute assessment. Only change what your hiring process actually needs.</Typography>
                    </Box>

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                        <TextField fullWidth type="number" label="Estimated duration (minutes)" value={form.durationMinutes} onChange={(event) => setField("durationMinutes", event.target.value)} inputProps={{ min: 5, max: 240 }} />
                        <TextField fullWidth type="email" label="Candidate support email (optional)" value={form.contactEmail} onChange={(event) => setField("contactEmail", event.target.value)} />
                    </Stack>
                    <TextField fullWidth multiline minRows={3} label="Candidate instructions (optional)" value={form.candidateInstructions} onChange={(event) => setField("candidateInstructions", event.target.value)} placeholder="Explain anything candidates should know before they begin." />

                    <Box>
                        <Typography variant="body2" fontWeight={850} mb={1}>Who can start?</Typography>
                        <ToggleButtonGroup exclusive fullWidth value={form.inviteOnly ? "invite" : "link"} onChange={(_, value) => value && setField("inviteOnly", value === "invite")}>
                            <ToggleButton value="link">Anyone with the link</ToggleButton>
                            <ToggleButton value="invite">Invited candidates only</ToggleButton>
                        </ToggleButtonGroup>
                    </Box>
                    <Collapse in={form.inviteOnly} unmountOnExit>
                        <TextField fullWidth required multiline minRows={4} label="Candidate email addresses" value={form.inviteEmails} onChange={(event) => setField("inviteEmails", event.target.value)} placeholder={"candidate@example.com\nanother@example.com"} helperText={`${inviteEmails.length} candidate${inviteEmails.length === 1 ? "" : "s"} added. Separate addresses with commas or new lines.`} />
                    </Collapse>

                    <Box component="details" sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 2, "& > summary": { cursor: "pointer", fontWeight: 850 } }}>
                        <Typography component="summary">Schedule and deadline</Typography>
                        <Typography variant="body2" color="text.secondary" mt={1}>Leave these blank to publish immediately whenever you are ready.</Typography>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} mt={2}>
                            <TextField fullWidth type="datetime-local" label="Opens at" value={form.opensAt} onChange={(event) => setField("opensAt", event.target.value)} InputLabelProps={{ shrink: true }} />
                            <TextField fullWidth type="datetime-local" label="Submission deadline" value={form.expiresAt} onChange={(event) => setField("expiresAt", event.target.value)} InputLabelProps={{ shrink: true }} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">Times use {form.timezone}.</Typography>
                    </Box>

                    <Box component="details" sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 2, "& > summary": { cursor: "pointer", fontWeight: 850 } }}>
                        <Typography component="summary">Integrity signals (optional)</Typography>
                        <Alert severity="info" sx={{ mt: 1.5, mb: 1.5 }}>These signals are review context only. They must never automatically disqualify a candidate.</Alert>
                        <FormControlLabel control={<Checkbox checked={form.integrity.enabled} onChange={(event) => setField("integrity", { ...form.integrity, enabled: event.target.checked })} />} label="Enable integrity event tracking with candidate consent" />
                        {form.integrity.enabled && <Stack spacing={1} mt={1.5}>
                            <FormControlLabel control={<Checkbox checked={form.integrity.requireCamera} onChange={(event) => setField("integrity", { ...form.integrity, requireCamera: event.target.checked, monitorFacePresence: event.target.checked })} />} label="Require camera readiness" />
                            <FormControlLabel control={<Checkbox disabled={!form.integrity.requireCamera} checked={form.integrity.monitorFacePresence} onChange={(event) => setField("integrity", { ...form.integrity, monitorFacePresence: event.target.checked })} />} label="Monitor face presence" />
                            <FormControlLabel control={<Checkbox checked={form.integrity.requireFullscreen} onChange={(event) => setField("integrity", { ...form.integrity, requireFullscreen: event.target.checked })} />} label="Request fullscreen" />
                            <FormControlLabel control={<Checkbox checked={form.integrity.trackFocus} onChange={(event) => setField("integrity", { ...form.integrity, trackFocus: event.target.checked })} />} label="Track focus changes" />
                            <FormControlLabel control={<Checkbox checked={form.integrity.trackClipboard} onChange={(event) => setField("integrity", { ...form.integrity, trackClipboard: event.target.checked })} />} label="Track copy/paste" />
                            <TextField type="number" label="Retention days" value={form.integrity.retentionDays} onChange={(event) => setField("integrity", { ...form.integrity, retentionDays: event.target.value })} inputProps={{ min: 1, max: 365 }} sx={{ maxWidth: 220 }} />
                        </Stack>}
                    </Box>

                    <TextField fullWidth label="Internal template name (optional)" value={form.templateName} onChange={(event) => setField("templateName", event.target.value)} helperText="Useful if your team plans to duplicate this setup later." />
                </Stack>}

                {stepKey === "review" && <Stack spacing={2.5}>
                    <Box>
                        <Typography variant="overline" color="primary.main" fontWeight={850}>Step 4</Typography>
                        <Typography component="h2" variant="h5" fontWeight={850}>Review before candidates see it</Typography>
                        <Typography color="text.secondary" mt={.5}>Check the candidate experience, then save privately, schedule, or publish now.</Typography>
                    </Box>

                    {readinessIssue ? <Alert severity="warning">{readinessIssue}</Alert> : <Alert severity="success" icon={<CheckCircleRounded />}>Ready to publish. You can still edit any section below.</Alert>}

                    <Stack spacing={1.5}>
                        <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                                <Box><Typography variant="overline" color="text.secondary" fontWeight={800}>Role</Typography><Typography variant="h6" fontWeight={850}>{form.title}</Typography><Typography color="text.secondary">{form.jobRole} · {activeOrganization.name}</Typography></Box>
                                <Button startIcon={<EditRounded />} onClick={() => moveToStep(0)}>Edit</Button>
                            </Stack>
                        </Paper>

                        <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2} mb={1.5}>
                                <Box><Typography variant="overline" color="text.secondary" fontWeight={800}>Interview plan</Typography><Typography fontWeight={850}>{form.rounds.length} round{form.rounds.length === 1 ? "" : "s"} · {assessmentQuality.total} configured question{assessmentQuality.total === 1 ? "" : "s"}</Typography></Box>
                                <Button startIcon={<EditRounded />} onClick={() => moveToStep(1)}>Edit</Button>
                            </Stack>
                            <Stack spacing={1}>{form.rounds.map((round, index) => <Stack key={index} direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={.5}><Typography fontWeight={750}>{index + 1}. {round.name}</Typography><Typography variant="body2" color="text.secondary">{round.deliveryMode === "conversational" ? "Interview" : round.deliveryMode === "online-assessment" ? "Coding / written" : "System design"} · {round.questions.filter((question) => question.text?.trim()).length} reviewed</Typography></Stack>)}</Stack>
                        </Paper>

                        <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                                <Box><Typography variant="overline" color="text.secondary" fontWeight={800}>Candidate setup</Typography><Typography fontWeight={850}>{form.inviteOnly ? `${inviteEmails.length} invited candidate${inviteEmails.length === 1 ? "" : "s"}` : "Shareable candidate link"}</Typography><Typography variant="body2" color="text.secondary">About {form.durationMinutes} minutes{form.opensAt ? ` · opens ${new Date(form.opensAt).toLocaleString()}` : " · publish anytime"}{form.integrity.enabled ? " · integrity signals enabled" : ""}</Typography></Box>
                                <Button startIcon={<EditRounded />} onClick={() => moveToStep(2)}>Edit</Button>
                            </Stack>
                        </Paper>
                    </Stack>

                    <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3, bgcolor: "action.hover" }}>
                        <Typography fontWeight={850}>Quality check</Typography>
                        <Typography variant="body2" color="text.secondary" mb={1.5}>These are prompts for human review, not automatic hiring rules.</Typography>
                        <Stack direction="row" gap={1} flexWrap="wrap">
                            <Chip size="small" color={assessmentQuality.duplicates ? "warning" : "success"} label={assessmentQuality.duplicates ? `${assessmentQuality.duplicates} duplicate question(s)` : "No duplicate questions"} />
                            <Chip size="small" color={assessmentQuality.targetMismatch ? "warning" : "success"} label={assessmentQuality.targetMismatch ? `${assessmentQuality.targetMismatch} round budget mismatch` : "Round budgets valid"} />
                            <Chip size="small" variant="outlined" label={`${assessmentQuality.coverage}% JD keyword coverage`} />
                            {form.rubric.length > 0 && <Chip size="small" variant="outlined" label={`${form.rubric.length} scorecard criteria`} />}
                        </Stack>
                    </Paper>
                </Stack>}
            </Paper>

            <Paper elevation={0} variant="outlined" sx={{ position: "sticky", bottom: 12, zIndex: 8, mt: 2, p: 1.25, borderRadius: 3, boxShadow: 6, bgcolor: "background.paper" }}>
                <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} gap={1}>
                    <Button startIcon={<ArrowBackRounded />} disabled={activeStep === 0 || saving} onClick={() => moveToStep(activeStep - 1)}>Back</Button>
                    <Box sx={{ flex: 1, px: { sm: 1 } }}>
                        <Typography variant="body2" fontWeight={800}>{ASSESSMENT_WIZARD_STEPS[activeStep].label}</Typography>
                        <Typography variant="caption" color="text.secondary">{currentStepIssue || (activeStep < 3 ? "This step is ready." : "Choose how you want to save or launch it.")}</Typography>
                    </Box>
                    {activeStep < ASSESSMENT_WIZARD_STEPS.length - 1 ? (
                        <Button variant="contained" endIcon={<ArrowForwardRounded />} disabled={saving} onClick={() => moveToStep(activeStep + 1)}>Continue</Button>
                    ) : <Stack direction={{ xs: "column", sm: "row" }} gap={1}>
                        <Button variant="outlined" disabled={saving || Boolean(assessmentStepIssue(form, "role") || assessmentStepIssue(form, "plan") || assessmentStepIssue(form, "candidate"))} onClick={() => saveAssessment("draft")}>
                            {saving ? <CircularProgress size={20} /> : "Save draft"}
                        </Button>
                        {form.opensAt && <Button variant="outlined" startIcon={<ScheduleRounded />} disabled={saving || Boolean(readinessIssue)} onClick={() => saveAssessment("schedule")}>Schedule</Button>}
                        <Button variant="contained" startIcon={<SendRounded />} disabled={saving || Boolean(readinessIssue)} onClick={() => saveAssessment("publish")}>
                            {saving ? <CircularProgress size={20} color="inherit" /> : "Publish now"}
                        </Button>
                    </Stack>}
                </Stack>
            </Paper>
        </Container>
    );
}
