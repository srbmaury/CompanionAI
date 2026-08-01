import { useEffect, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

// API / Context
import api from "../api/axios";
import { useResumes } from "../hooks/useResumes";
import { trackEvent } from "../utils/analytics";

// UI Components
import Alert from "@mui/material/Alert";
import {
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    FormControlLabel,
    FormHelperText,
    IconButton,
    Link,
    MenuItem,
    Paper,
    Snackbar,
    Stack,
    Step,
    StepLabel,
    Stepper,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";

// Icons
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

// Local components
import RoundSelector from "../components/RoundSelector";

const INTERVIEW_PRESETS = [
    { name: "Frontend", company: "Target company", jobRole: "Frontend Engineer", jobDescription: "Build accessible, performant web applications with React, JavaScript, testing, API integration, and modern frontend architecture." },
    { name: "Backend", company: "Target company", jobRole: "Backend Engineer", jobDescription: "Design reliable APIs and distributed services with databases, caching, queues, observability, security, testing, and scalable system design." },
    { name: "Full stack", company: "Target company", jobRole: "Full Stack Engineer", jobDescription: "Own product features end to end across React, APIs, data modeling, testing, deployment, performance, security, and cross-functional collaboration." },
];

const CreateInterviewPage = () => {
    const { getResumes, deleteResume, uploadResume } = useResumes();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        company: "",
        jobRole: "",
        jobDescription: "",
        resumeId: "",
    });

    const [resumes, setResumes] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadConsent, setUploadConsent] = useState(false);

    const [suggestedRounds, setSuggestedRounds] = useState([]);
    const [grounding, setGrounding] = useState(null);
    const [selectedRounds, setSelectedRounds] = useState([]);
    const [loadingRounds, setLoadingRounds] = useState(false);
    const [snack, setSnack] = useState({
        open: false,
        severity: "info",
        message: "",
    });

    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState("");
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [activeStep, setActiveStep] = useState(0);

    // Fetch resumes on mount
    useEffect(() => {
        const fetchResumes = async () => {
            const res = await getResumes();
            if (res) setResumes(res);
        };
        fetchResumes();
    }, [getResumes]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            setUploading(true);
            const newResume = await uploadResume(file);
            if (newResume) {
                setResumes((prev) => [...prev, newResume]);
                setFormData((prev) => ({ ...prev, resumeId: newResume._id }));
                setSnack({
                    open: true,
                    severity: "success",
                    message: "Resume uploaded",
                });
            }
        } catch (err) {
            console.error("Upload failed", err);
            setSnack({
                open: true,
                severity: "error",
                message: "Resume upload failed",
            });
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id) => {
        const ok = await deleteResume(id);
        if (ok) {
            setResumes((prev) => prev.filter((r) => r._id !== id));
            if (formData.resumeId === id) {
                setFormData((prev) => ({ ...prev, resumeId: "" }));
            }
        }
    };

    const handlePreviewResume = (r) => {
        if (!r) return;
        if (r.fileType !== "application/pdf") {
            setSnack({ open: true, severity: "warning", message: "Preview available for PDFs only" });
            return;
        }
        setPreviewUrl(`/api/resumes/${r._id}/preview`);
        setPreviewOpen(true);
    };

    const handleSuggestRounds = async () => {
        setLoadingRounds(true);
        setSelectedRounds([]);
        setGrounding(null);
        try {
            const { data } = await api.post(`/rounds/suggest`, {
                company: formData.company,
                jobRole: formData.jobRole,
                jobDescription: formData.jobDescription,
            });
            const rounds = Array.isArray(data) ? data : (Array.isArray(data?.rounds) ? data.rounds : []);
            setGrounding(Array.isArray(data) ? null : data?.grounding || null);
            setSuggestedRounds(rounds);
            if (rounds.length > 0) setActiveStep(1);
            setSnack({
                open: true,
                severity: "success",
                message: "Rounds suggested",
            });
        } catch (error) {
            console.error(error);
            setSnack({
                open: true,
                severity: "error",
                message: "Error suggesting rounds",
            });
        } finally {
            setLoadingRounds(false);
        }
    };

    const handleToggleRound = (round) => {
        setSelectedRounds((prev) => {
            const exists = prev.some((r) => r.roundName === round.roundName);
            if (exists) {
                return prev.filter((r) => r.roundName !== round.roundName);
            } else {
                // Default deliveryMode to conversational
                return [...prev, { ...round, deliveryMode: "conversational" }];
            }
        });
    };

    const handleChangeMode = (roundName, mode) => {
        setSelectedRounds((prev) =>
            prev.map((r) =>
                r.roundName === roundName ? { ...r, deliveryMode: mode } : r
            )
        );
    };

    const handleChangeCount = (roundName, num) => {
        const safe = Math.min(Math.max(Number(num) || 8, 1), 20);
        setSelectedRounds((prev) =>
            prev.map((r) =>
                r.roundName === roundName ? { ...r, questionLimit: safe } : r
            )
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.resumeId) return;
        if (selectedRounds.length === 0) {
            setSnack({ open: true, severity: "warning", message: "Please select at least one round" });
            return;
        }

        try {
            // Bulk create interview with raw rounds
            const { data } = await api.post(`/interviews`, {
                ...formData,
                rounds: selectedRounds,
            });
            if (data && data._id) {
                trackEvent("interview_created");
                setSnack({
                    open: true,
                    severity: "success",
                    message: "Interview created",
                });
                navigate(`/interviews/${data._id}`);
            } else {
                setSnack({
                    open: true,
                    severity: "error",
                    message: "Failed to create interview",
                });
            }
        } catch (error) {
            console.log("error", error);
            setSnack({
                open: true,
                severity: "error",
                message: "Failed to create interview",
            });
        }
    };

    const isFormValid =
        formData.company &&
        formData.jobRole &&
        formData.jobDescription &&
        formData.resumeId;

    return (
        <Paper elevation={0} variant="outlined" sx={{ p: { xs: 2.5, sm: 4.5 }, maxWidth: 920, mx: "auto", my: { xs: 3, md: 6 }, borderRadius: 4 }}>
            <Typography variant="overline" color="primary.main" fontWeight={850}>New practice session</Typography>
            <Typography variant="h4" fontWeight={850} letterSpacing="-.03em" mt={.5}>Build your interview plan</Typography>
            <Typography color="text.secondary" mt={1}>Tell us what you’re preparing for. You’ll review every suggested round before anything starts.</Typography>
            <Stepper activeStep={activeStep} sx={{ my: 4 }}>
                <Step><StepLabel>Role and resume</StepLabel></Step>
                <Step><StepLabel>Review interview plan</StepLabel></Step>
            </Stepper>

            {/* Inline notifications */}
            {snack.open && (
                <Alert
                    severity={snack.severity}
                    aria-live={snack.severity === "error" ? undefined : "polite"}
                    role={snack.severity === "error" ? "alert" : undefined}
                    sx={{ mb: 2 }}
                    onClose={() => setSnack((s) => ({ ...s, open: false }))}
                >
                    {snack.message}
                </Alert>
            )}

            <form onSubmit={handleSubmit}>
                <Stack spacing={2}>
                    <Box sx={{ display: activeStep === 0 ? "block" : "none" }}>
                    <Stack spacing={2}>
                    <Typography variant="h6" fontWeight={750}>Target role</Typography>
                    <Box>
                        <Typography variant="body2" color="text.secondary" mb={1}>Start quickly with a preset, then tailor every field to the actual job.</Typography>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            {INTERVIEW_PRESETS.map((preset) => <Button key={preset.name} variant="outlined" startIcon={<AutoAwesomeIcon />} onClick={() => setFormData((current) => ({ ...current, company: preset.company, jobRole: preset.jobRole, jobDescription: preset.jobDescription }))}>{preset.name}</Button>)}
                        </Stack>
                    </Box>
                    <TextField
                        label="Company"
                        name="company"
                        value={formData.company}
                        onChange={handleChange}
                        required
                    />
                    <TextField
                        label="Job Role"
                        name="jobRole"
                        value={formData.jobRole}
                        onChange={handleChange}
                        required
                    />
                    <TextField
                        label="Job Description"
                        name="jobDescription"
                        value={formData.jobDescription}
                        multiline
                        rows={4}
                        onChange={handleChange}
                        required
                    />

                    <Divider sx={{ my: 2.5 }} />

                    <FormControl required error={!formData.resumeId}>
                        <Typography variant="h6" fontWeight={750}>
                            Resume context
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mb={1}>Use the resume you’ll submit so questions reflect your actual experience.</Typography>

                        {/* Upload New Resume */}
                        <Box sx={{ my: 1 }}>
                            <Button
                                variant="outlined"
                                component="label"
                                disabled={uploading || !uploadConsent}
                            >
                                {uploading
                                    ? "Uploading..."
                                    : "Upload Resume (PDF)"}
                                <input
                                    type="file"
                                    hidden
                                    accept="application/pdf"
                                    onChange={handleUpload}
                                />
                            </Button>
                            <FormControlLabel
                                sx={{ display: "flex", mt: 1, alignItems: "flex-start" }}
                                control={<Checkbox checked={uploadConsent} onChange={(event) => setUploadConsent(event.target.checked)} size="small" />}
                                label={<Typography variant="caption" color="text.secondary">I understand my resume will be stored and processed by configured service providers to generate interview content. See the <Link component={RouterLink} to="/privacy">privacy notice</Link>.</Typography>}
                            />
                        </Box>

                        {/* Or Choose Existing */}
                        {resumes.length > 0 && (
                            <TextField
                                select
                                label="Choose from existing resumes"
                                value={formData.resumeId}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        resumeId: e.target.value,
                                    })
                                }
                                required
                            >
                                {resumes.map((r) => (
                                    <MenuItem key={r._id} value={r._id}>
                                        {r.fileName || "Untitled Resume"} —{" "}
                                        {new Date(
                                            r.createdAt
                                        ).toLocaleDateString()}
                                    </MenuItem>
                                ))}
                            </TextField>
                        )}
                        {formData.resumeId && (() => {
                            const selectedResume = resumes.find((resume) => resume._id === formData.resumeId);
                            if (!selectedResume) return null;
                            return <Stack direction="row" spacing={1} alignItems="center" mt={1}>
                                <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>Selected: {selectedResume.fileName || "Untitled resume"}</Typography>
                                <Tooltip title="Download"><IconButton size="small" component="a" href={selectedResume.fileUrl} download><DownloadIcon fontSize="small" /></IconButton></Tooltip>
                                <Tooltip title="Preview"><IconButton size="small" onClick={() => handlePreviewResume(selectedResume)}><PictureAsPdfIcon fontSize="small" /></IconButton></Tooltip>
                                <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDeleteConfirmId(selectedResume._id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                            </Stack>;
                        })()}

                        {!formData.resumeId && (
                            <FormHelperText>
                                Please select or upload a resume
                            </FormHelperText>
                        )}
                    </FormControl>

                    <Divider sx={{ my: 2 }} />

                    {/* Suggest rounds */}
                    <Tooltip title={!isFormValid ? "Fill in company, role, description, and select a resume first" : "AI will suggest interview rounds based on your details"}>
                        <span>
                            <Button
                                variant="outlined"
                                onClick={handleSuggestRounds}
                                disabled={!isFormValid || loadingRounds}
                                fullWidth
                                size="large"
                            >
                                {loadingRounds ? (
                                    <CircularProgress size={20} />
                                ) : (
                                    "Build my interview plan"
                                )}
                            </Button>
                        </span>
                    </Tooltip>
                    </Stack>
                    </Box>

                    {/* Show suggested rounds */}
                    {activeStep === 1 && <>
                    <Typography variant="h6" fontWeight={750}>Choose the rounds you want to practice</Typography>
                    {grounding && (
                        <Alert severity={grounding.status === "grounded" ? "success" : "info"}>
                            {grounding.status === "grounded"
                                ? `Grounded in ${grounding.sourceCount} public company/role experience source${grounding.sourceCount === 1 ? "" : "s"}. Questions will combine this evidence with your JD and resume.`
                                : "Limited public company-specific evidence was found. This plan is clearly treated as an AI simulation based on the JD, role, and resume."}
                        </Alert>
                    )}
                    <RoundSelector
                        suggestedRounds={suggestedRounds}
                        selectedRounds={selectedRounds}
                        onToggleRound={handleToggleRound}
                        onChangeMode={handleChangeMode}
                        onChangeCount={handleChangeCount}
                    />
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                        <Button variant="outlined" onClick={() => setActiveStep(0)}>Back</Button>
                        <Button type="submit" variant="contained" disabled={!isFormValid || selectedRounds.length === 0} sx={{ flex: 1 }}>Start Interview</Button>
                    </Stack>
                    </>}
                </Stack>
            </form>

            {/* PDF preview dialog */}
            <Dialog
                open={previewOpen}
                onClose={() => setPreviewOpen(false)}
                fullWidth
                maxWidth="xl"
                PaperProps={{ sx: { height: "92vh" } }}
                aria-labelledby="resume-preview-title"
            >
                <DialogTitle id="resume-preview-title">Preview</DialogTitle>
                <DialogContent dividers sx={{ p: 0, height: "100%" }}>
                    {previewUrl ? (
                        <iframe
                            src={previewUrl}
                            title="Resume Preview"
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                        />
                    ) : null}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPreviewOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
            <Dialog open={Boolean(deleteConfirmId)} onClose={() => setDeleteConfirmId(null)} aria-labelledby="create-delete-resume-title">
                <DialogTitle id="create-delete-resume-title">Delete this resume?</DialogTitle>
                <DialogContent><Typography>This permanently removes the resume from your account and may affect interviews that use it.</Typography></DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                    <Button color="error" variant="contained" onClick={async () => { const id = deleteConfirmId; setDeleteConfirmId(null); await handleDelete(id); }}>Delete</Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
};

export default CreateInterviewPage;
