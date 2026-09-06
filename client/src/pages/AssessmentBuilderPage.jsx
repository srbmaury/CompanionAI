import { useContext, useMemo, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate } from "react-router-dom";
import {
    AddRounded,
    AutoAwesomeRounded,
    DeleteOutlineRounded,
    KeyboardArrowLeftRounded,
    KeyboardArrowRightRounded,
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
    Grid,
    IconButton,
    MenuItem,
    Paper,
    Stack,
    Step,
    StepLabel,
    Stepper,
    TextField,
    Typography,
} from "@mui/material";
import api from "../api/axios";
import JobPostImporter from "../components/JobPostImporter";
import { OrganizationContext } from "../context/OrganizationContext";
import { useNotify } from "../context/NotificationContext";
import { hiringPermissionsFor } from "../utils/hiringPermissions";
import { trackEvent } from "../utils/analytics";

const steps = ["Role", "Interview plan", "Questions", "Launch"];
const experienceNames = { conversational: "Interview", "online-assessment": "Coding / written", "system-design": "System design" };
const emptyRound = (deliveryMode = "conversational") => ({
    name: deliveryMode === "system-design" ? "System design" : deliveryMode === "online-assessment" ? "Coding" : "Interview",
    description: "Role-specific knowledge and practical judgment",
    deliveryMode,
    adaptive: deliveryMode === "conversational",
    questionCount: deliveryMode === "system-design" ? 1 : 3,
    aiPrompt: "",
    questions: [],
});

const initialForm = {
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
};

const starterPresets = {
    engineering: {
        jobRole: "Software Engineer",
        jobDescription: "Build reliable, secure, maintainable software; explain trade-offs; test solutions; and communicate technical decisions clearly.",
        rounds: [emptyRound("conversational")],
    },
    product: {
        jobRole: "Product Manager",
        jobDescription: "Discover customer needs, prioritize outcomes, define success metrics, and align cross-functional teams through ambiguity.",
        rounds: [emptyRound("conversational")],
    },
    sales: {
        jobRole: "Account Executive",
        jobDescription: "Qualify opportunities, uncover customer value, handle objections, and manage a clear and ethical sales process.",
        rounds: [emptyRound("conversational")],
    },
};

export default function AssessmentBuilderPage() {
    const navigate = useNavigate();
    const notify = useNotify();
    const { activeOrganization, currentRole, loading } = useContext(OrganizationContext);
    const permissions = hiringPermissionsFor(currentRole);
    const [activeStep, setActiveStep] = useState(0);
    const [form, setForm] = useState(initialForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [generatingRound, setGeneratingRound] = useState(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
    const updateRound = (index, patch) => setForm((current) => ({
        ...current,
        rounds: current.rounds.map((round, position) => position === index ? { ...round, ...patch } : round),
    }));

    const applyStarter = (kind) => {
        const starter = starterPresets[kind];
        setForm((current) => ({
            ...current,
            ...starter,
            title: `${starter.jobRole} Assessment`,
        }));
    };

    const stepValid = useMemo(() => {
        if (activeStep === 0) return Boolean(form.jobRole.trim() && form.title.trim() && form.jobDescription.trim().length >= 20);
        if (activeStep === 1) return form.rounds.length > 0 && form.rounds.every((round) => round.name.trim() && round.description.trim());
        if (activeStep === 2) return form.rounds.every((round) => round.questions.some((question) => question.text?.trim()));
        return true;
    }, [activeStep, form]);

    const generateQuestions = async (roundIndex) => {
        const round = form.rounds[roundIndex];
        if (!form.jobRole.trim() || form.jobDescription.trim().length < 20) {
            setError("Finish the role step before generating questions.");
            return;
        }
        setGeneratingRound(roundIndex);
        setError("");
        try {
            const { data } = await api.post("/assessments/questions/generate", {
                jobRole: form.jobRole,
                jobDescription: form.jobDescription,
                roundName: round.name,
                roundDescription: round.description,
                deliveryMode: round.deliveryMode,
                prompt: round.aiPrompt || `Generate ${round.questionCount} strong ${experienceNames[round.deliveryMode]} questions for this role.`,
                count: Math.max(1, Math.min(10, Number(round.questionCount) || 3)),
                existingQuestions: round.questions.filter((question) => question.text?.trim()).map((question) => question.text),
            });
            const generated = (data.questions || []).map((question) => ({
                ...question,
                text: question.text || "",
                required: Boolean(question.required),
            }));
            updateRound(roundIndex, { questions: generated.length ? generated : round.questions });
        } catch (err) {
            setError(err?.response?.data?.message || "AI couldn’t generate questions right now. Add them manually or try again.");
        } finally {
            setGeneratingRound(null);
        }
    };

    const addQuestion = (roundIndex) => {
        const round = form.rounds[roundIndex];
        updateRound(roundIndex, { questions: [...round.questions, { text: "", required: true }] });
    };

    const updateQuestion = (roundIndex, questionIndex, patch) => {
        const round = form.rounds[roundIndex];
        updateRound(roundIndex, {
            questions: round.questions.map((question, index) => index === questionIndex ? { ...question, ...patch } : question),
        });
    };

    const removeQuestion = (roundIndex, questionIndex) => {
        const round = form.rounds[roundIndex];
        updateRound(roundIndex, { questions: round.questions.filter((_, index) => index !== questionIndex) });
    };

    const save = async (intent) => {
        if (!permissions.canManageAssessments) return;
        const publishNow = intent === "publish";
        const schedule = intent === "schedule";
        const rounds = form.rounds.map((round) => ({
            ...round,
            questions: round.questions
                .map((question) => ({
                    text: question.text.trim(),
                    required: Boolean(question.required),
                    weight: Number(question.weight) || 1,
                    competencies: question.competencies || [],
                    knockout: Boolean(question.knockout),
                }))
                .filter((question) => question.text),
        }));
        if (rounds.some((round) => !round.questions.length)) {
            setError("Add at least one question to every interview round.");
            setActiveStep(2);
            return;
        }
        if (schedule && (!form.opensAt || new Date(form.opensAt) <= new Date())) {
            setError("Choose a future opening time before scheduling.");
            return;
        }
        const candidates = form.inviteEmails.split(/[\n,;]+/).map((email) => email.trim()).filter(Boolean).map((email) => ({ email }));
        if ((publishNow || schedule) && form.inviteOnly && !candidates.length) {
            setError("Add at least one candidate email for an invite-only assessment.");
            return;
        }
        setSaving(true);
        setError("");
        try {
            const status = publishNow ? "active" : schedule ? "scheduled" : "draft";
            const payload = {
                ...form,
                inviteEmails: undefined,
                opensAt: form.opensAt ? new Date(form.opensAt).toISOString() : null,
                expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
                rounds,
                status,
            };
            delete payload.inviteEmails;
            const { data: created } = await api.post("/assessments", payload);
            if ((publishNow || schedule) && candidates.length) {
                await api.post(`/assessments/${created._id}/invitations`, { candidates });
            }
            trackEvent(publishNow ? "assessment_published" : schedule ? "assessment_scheduled" : "assessment_draft_saved");
            notify(publishNow ? "Assessment published." : schedule ? "Assessment scheduled." : "Draft saved.", "success");
            navigate(`/hire/assessments/${created._id}`);
        } catch (err) {
            setError(err?.response?.data?.message || "The assessment couldn’t be saved. Check the details and try again.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <Stack minHeight="50vh" alignItems="center" justifyContent="center"><CircularProgress /></Stack>;
    if (!activeOrganization) return <Navigate to="/hire/team" replace />;
    if (!permissions.canManageAssessments) return <Navigate to="/hire/assessments" replace />;

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2} mb={3}>
                <Box>
                    <Button component={RouterLink} to="/hire/assessments#assessment-list" startIcon={<KeyboardArrowLeftRounded />} color="inherit" sx={{ mb: 1 }}>Back to assessments</Button>
                    <Typography component="h1" variant="h3" sx={{ fontSize: { xs: "2.2rem", sm: "2.8rem" } }} fontWeight={850}>Create an assessment</Typography>
                    <Typography color="text.secondary" mt={1}>Make one decision at a time. You can review everything before candidates see it.</Typography>
                </Box>
                <Chip label={`Creating for ${activeOrganization.name}`} variant="outlined" sx={{ alignSelf: { md: "flex-start" } }} />
            </Stack>

            <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, mb: 3, overflowX: "auto" }}>
                <Stepper activeStep={activeStep} alternativeLabel sx={{ minWidth: 520 }}>
                    {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
                </Stepper>
            </Paper>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 8 }}>
                    <Paper variant="outlined" sx={{ p: { xs: 2.25, sm: 3 }, borderRadius: 3 }}>
                        {activeStep === 0 && <Stack spacing={2.25}>
                            <Box><Typography variant="overline" color="primary.main" fontWeight={850}>Step 1 of 4</Typography><Typography variant="h5" fontWeight={850}>What are you hiring for?</Typography><Typography color="text.secondary" variant="body2" mt={.5}>A clear role definition gives the question generator and reviewers the right context.</Typography></Box>
                            <Stack direction="row" gap={1} flexWrap="wrap"><Button size="small" variant="outlined" onClick={() => applyStarter("engineering")}>Engineering starter</Button><Button size="small" variant="outlined" onClick={() => applyStarter("product")}>Product starter</Button><Button size="small" variant="outlined" onClick={() => applyStarter("sales")}>Sales starter</Button></Stack>
                            <JobPostImporter onImport={({ jobRole, jobDescription }) => setForm((current) => ({ ...current, jobRole, jobDescription, title: `${jobRole} Assessment` }))} />
                            <TextField required fullWidth label="Job role" value={form.jobRole} onChange={(event) => setForm((current) => ({ ...current, jobRole: event.target.value, title: current.title || `${event.target.value} Assessment` }))} />
                            <TextField required fullWidth label="Assessment name" helperText="Candidates will see this name." value={form.title} onChange={(event) => setField("title", event.target.value)} />
                            <TextField required multiline minRows={5} label="Job description and success criteria" helperText="Responsibilities, seniority, must-have skills, and what strong performance looks like." value={form.jobDescription} onChange={(event) => setField("jobDescription", event.target.value)} inputProps={{ minLength: 20 }} />
                        </Stack>}

                        {activeStep === 1 && <Stack spacing={2.25}>
                            <Box><Typography variant="overline" color="primary.main" fontWeight={850}>Step 2 of 4</Typography><Typography variant="h5" fontWeight={850}>Choose the candidate experience</Typography><Typography color="text.secondary" variant="body2" mt={.5}>Start simple. Add another round only when it measures something meaningfully different.</Typography></Box>
                            {form.rounds.map((round, index) => <Card variant="outlined" key={index}><CardContent><Stack spacing={2}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography fontWeight={850}>Round {index + 1}</Typography><Typography variant="body2" color="text.secondary">{experienceNames[round.deliveryMode]}</Typography></Box>{form.rounds.length > 1 && <IconButton aria-label={`Remove round ${index + 1}`} onClick={() => setField("rounds", form.rounds.filter((_, position) => position !== index))}><DeleteOutlineRounded /></IconButton>}</Stack>
                                <TextField select label="Format" value={round.deliveryMode} onChange={(event) => { const deliveryMode = event.target.value; updateRound(index, { deliveryMode, name: deliveryMode === "system-design" ? "System design" : deliveryMode === "online-assessment" ? "Coding" : "Interview", adaptive: deliveryMode === "conversational", questionCount: deliveryMode === "system-design" ? 1 : Math.max(Number(round.questionCount) || 3, 1) }); }}><MenuItem value="conversational">Conversational interview</MenuItem><MenuItem value="online-assessment">Coding / written assessment</MenuItem><MenuItem value="system-design">System design</MenuItem></TextField>
                                <TextField label="Round name" value={round.name} onChange={(event) => updateRound(index, { name: event.target.value })} />
                                <TextField multiline minRows={2} label="What should this round evaluate?" value={round.description} onChange={(event) => updateRound(index, { description: event.target.value })} />
                                {round.deliveryMode !== "system-design" && <TextField type="number" label={round.adaptive ? "Maximum primary questions" : "Question count"} value={round.questionCount} onChange={(event) => updateRound(index, { questionCount: Math.max(1, Math.min(10, Number(event.target.value) || 1)) })} inputProps={{ min: 1, max: 10 }} />}
                                {round.deliveryMode === "conversational" && <FormControlLabel control={<Checkbox checked={round.adaptive !== false} onChange={(event) => updateRound(index, { adaptive: event.target.checked })} />} label="Let AI adapt the remaining primary questions to the candidate" />}
                            </Stack></CardContent></Card>)}
                            <Button startIcon={<AddRounded />} variant="outlined" onClick={() => setField("rounds", [...form.rounds, emptyRound()])}>Add another round</Button>
                        </Stack>}

                        {activeStep === 2 && <Stack spacing={2.5}>
                            <Box><Typography variant="overline" color="primary.main" fontWeight={850}>Step 3 of 4</Typography><Typography variant="h5" fontWeight={850}>Define the evidence you need</Typography><Typography color="text.secondary" variant="body2" mt={.5}>Generate a starting set, then keep only questions you would actually use to make a hiring decision.</Typography></Box>
                            {form.rounds.map((round, roundIndex) => <Card variant="outlined" key={roundIndex}><CardContent><Stack spacing={2}>
                                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}><Box><Typography fontWeight={850}>{round.name}</Typography><Typography variant="body2" color="text.secondary">{experienceNames[round.deliveryMode]} · target {round.questionCount} question{Number(round.questionCount) === 1 ? "" : "s"}</Typography></Box><Button startIcon={generatingRound === roundIndex ? <CircularProgress size={18} /> : <AutoAwesomeRounded />} variant="outlined" disabled={generatingRound !== null} onClick={() => generateQuestions(roundIndex)}>{generatingRound === roundIndex ? "Generating…" : "Generate with AI"}</Button></Stack>
                                <TextField multiline minRows={2} label="Optional AI brief" placeholder="Focus on debugging, API design, trade-offs, and seniority-appropriate judgment." value={round.aiPrompt} onChange={(event) => updateRound(roundIndex, { aiPrompt: event.target.value })} />
                                <Divider />
                                {round.questions.map((question, questionIndex) => <Stack key={questionIndex} direction={{ xs: "column", sm: "row" }} gap={1} alignItems={{ sm: "flex-start" }}><TextField fullWidth multiline minRows={2} label={`Question ${questionIndex + 1}`} value={question.text} onChange={(event) => updateQuestion(roundIndex, questionIndex, { text: event.target.value })} /><FormControlLabel control={<Checkbox checked={Boolean(question.required)} onChange={(event) => updateQuestion(roundIndex, questionIndex, { required: event.target.checked })} />} label="Must ask" /><IconButton aria-label={`Remove question ${questionIndex + 1}`} onClick={() => removeQuestion(roundIndex, questionIndex)}><DeleteOutlineRounded /></IconButton></Stack>)}
                                <Button size="small" startIcon={<AddRounded />} onClick={() => addQuestion(roundIndex)}>Add question</Button>
                            </Stack></CardContent></Card>)}
                        </Stack>}

                        {activeStep === 3 && <Stack spacing={2.25}>
                            <Box><Typography variant="overline" color="primary.main" fontWeight={850}>Step 4 of 4</Typography><Typography variant="h5" fontWeight={850}>Review and launch</Typography><Typography color="text.secondary" variant="body2" mt={.5}>Candidate-facing details first. Security, scheduling, and invitations stay optional until you need them.</Typography></Box>
                            <TextField multiline minRows={3} label="Candidate instructions" helperText="What should candidates know before they begin?" value={form.candidateInstructions} onChange={(event) => setField("candidateInstructions", event.target.value)} />
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}><TextField fullWidth type="email" label="Support email" value={form.contactEmail} onChange={(event) => setField("contactEmail", event.target.value)} /><TextField fullWidth type="number" label="Estimated duration (minutes)" value={form.durationMinutes} onChange={(event) => setField("durationMinutes", Number(event.target.value) || 30)} inputProps={{ min: 5, max: 240 }} /></Stack>
                            <FormControlLabel control={<Checkbox checked={form.followUpsEnabled} onChange={(event) => setField("followUpsEnabled", event.target.checked)} />} label="Allow contextual AI follow-up questions" />
                            <FormControlLabel control={<Checkbox checked={form.inviteOnly} onChange={(event) => setField("inviteOnly", event.target.checked)} />} label="Only invited candidates can access this assessment" />
                            {form.inviteOnly && <TextField multiline minRows={3} label="Candidate emails" placeholder="candidate@example.com" helperText="One per line, or separate with commas." value={form.inviteEmails} onChange={(event) => setField("inviteEmails", event.target.value)} />}
                            <Button variant="text" sx={{ alignSelf: "flex-start" }} onClick={() => setShowAdvanced((current) => !current)}>{showAdvanced ? "Hide advanced launch settings" : "Show scheduling and integrity settings"}</Button>
                            <Collapse in={showAdvanced}><Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={2}>
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}><TextField fullWidth type="datetime-local" label="Opens at" value={form.opensAt} onChange={(event) => setField("opensAt", event.target.value)} InputLabelProps={{ shrink: true }} /><TextField fullWidth type="datetime-local" label="Submission deadline" value={form.expiresAt} onChange={(event) => setField("expiresAt", event.target.value)} InputLabelProps={{ shrink: true }} /></Stack>
                                <FormControlLabel control={<Checkbox checked={form.integrity.enabled} onChange={(event) => setField("integrity", { ...form.integrity, enabled: event.target.checked })} />} label="Enable integrity monitoring" />
                                {form.integrity.enabled && <Stack pl={2}><FormControlLabel control={<Checkbox checked={form.integrity.requireFullscreen} onChange={(event) => setField("integrity", { ...form.integrity, requireFullscreen: event.target.checked })} />} label="Require fullscreen" /><FormControlLabel control={<Checkbox checked={form.integrity.requireCamera} onChange={(event) => setField("integrity", { ...form.integrity, requireCamera: event.target.checked })} />} label="Require camera" /></Stack>}
                            </Stack></Paper></Collapse>
                            <Alert severity="info">Saving a draft keeps the assessment private. Publish only after you’re happy with the candidate experience.</Alert>
                        </Stack>}

                        <Divider sx={{ my: 3 }} />
                        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                            <Button disabled={activeStep === 0 || saving} startIcon={<KeyboardArrowLeftRounded />} onClick={() => { setError(""); setActiveStep((step) => Math.max(0, step - 1)); }}>Back</Button>
                            {activeStep < steps.length - 1 ? <Button variant="contained" disabled={!stepValid} endIcon={<KeyboardArrowRightRounded />} onClick={() => { setError(""); setActiveStep((step) => Math.min(steps.length - 1, step + 1)); }}>Continue</Button> : <Stack direction="row" gap={1} flexWrap="wrap" justifyContent="flex-end"><Button variant="outlined" disabled={saving} onClick={() => save("draft")}>Save draft</Button>{form.opensAt && <Button variant="outlined" disabled={saving} onClick={() => save("schedule")}>Schedule</Button>}<Button variant="contained" disabled={saving} onClick={() => save("publish")}>{saving ? <CircularProgress size={20} color="inherit" /> : "Publish assessment"}</Button></Stack>}
                        </Stack>
                    </Paper>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3, position: { md: "sticky" }, top: { md: 96 } }}>
                        <Typography variant="overline" color="primary.main" fontWeight={850}>Assessment summary</Typography>
                        <Typography variant="h6" fontWeight={850} mt={.5}>{form.title || "Untitled assessment"}</Typography>
                        <Typography variant="body2" color="text.secondary">{form.jobRole || "Add a role to get started"}</Typography>
                        <Divider sx={{ my: 2 }} />
                        <Stack spacing={1.5}>{form.rounds.map((round, index) => <Box key={index}><Typography fontWeight={750}>{index + 1}. {round.name}</Typography><Typography variant="caption" color="text.secondary">{experienceNames[round.deliveryMode]} · {round.questions.filter((question) => question.text?.trim()).length} reviewed question{round.questions.filter((question) => question.text?.trim()).length === 1 ? "" : "s"}</Typography></Box>)}</Stack>
                        <Divider sx={{ my: 2 }} />
                        <Stack direction="row" gap={1} flexWrap="wrap"><Chip size="small" label={`${form.durationMinutes || 30} min`} /><Chip size="small" label={form.inviteOnly ? "Invite only" : "Shareable link"} /><Chip size="small" label={form.followUpsEnabled ? "AI follow-ups on" : "Fixed follow-ups"} /></Stack>
                    </Paper>
                </Grid>
            </Grid>
        </Container>
    );
}
