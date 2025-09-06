import { useEffect, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";

// API / Context
import api from "../api/axios";
import { AuthContext } from "../context/AuthContext";

// UI Components
import Alert from "@mui/material/Alert";
import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    FormHelperText,
    IconButton,
    MenuItem,
    Paper,
    Snackbar,
    Stack,
    TextField,
    Typography,
} from "@mui/material";

// Icons
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";

// Local components
import RoundSelector from "../components/RoundSelector";

const CreateInterviewPage = () => {
    const { getResumes, deleteResume, uploadResume } =
        useContext(AuthContext);
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        company: "",
        jobRole: "",
        jobDescription: "",
        resumeId: "",
    });

    const [resumes, setResumes] = useState([]);
    const [uploading, setUploading] = useState(false);

    const [suggestedRounds, setSuggestedRounds] = useState([]);
    const [selectedRounds, setSelectedRounds] = useState([]);
    const [loadingRounds, setLoadingRounds] = useState(false);
    const [snack, setSnack] = useState({
        open: false,
        severity: "info",
        message: "",
    });

    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState("");

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
        try {
            const { data } = await api.post(`/rounds/suggest`, {
                company: formData.company,
                jobRole: formData.jobRole,
                jobDescription: formData.jobDescription,
            });
            setSuggestedRounds(Array.isArray(data) ? data : []);
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
            alert("Please select at least one round");
            return;
        }

        try {
            // Bulk create interview with raw rounds
            const { data } = await api.post(`/interviews`, {
                ...formData,
                rounds: selectedRounds,
            });
            if (data && data._id) {
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
        <Paper sx={{ p: 3, maxWidth: 800, mx: "auto", mt: 4 }}>
            <Typography variant="h5" gutterBottom>
                Start a New Interview
            </Typography>

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

                    <Divider sx={{ my: 2 }} />

                    <FormControl required error={!formData.resumeId}>
                        <Typography variant="subtitle1">
                            Select Resume
                        </Typography>

                        {/* Upload New Resume */}
                        <Box sx={{ my: 1 }}>
                            <Button
                                variant="outlined"
                                component="label"
                                disabled={uploading}
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
                                        <IconButton
                                            color="primary"
                                            size="small"
                                            component="a"
                                            href={r.fileUrl}
                                            download
                                            onMouseDown={(e) => e.stopPropagation()}
                                        >
                                            <DownloadIcon />
                                        </IconButton>
                                        <IconButton
                                            color="secondary"
                                            size="small"
                                            sx={{ ml: 1 }}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handlePreviewResume(r);
                                            }}
                                        >
                                            <PictureAsPdfIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(r._id);
                                            }}
                                            sx={{ ml: 1 }}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </MenuItem>
                                ))}
                            </TextField>
                        )}

                        {!formData.resumeId && (
                            <FormHelperText>
                                Please select or upload a resume
                            </FormHelperText>
                        )}
                    </FormControl>

                    <Divider sx={{ my: 2 }} />

                    {/* Suggest rounds */}
                    <Button
                        variant="outlined"
                        onClick={handleSuggestRounds}
                        disabled={!isFormValid || loadingRounds}
                    >
                        {loadingRounds ? (
                            <CircularProgress size={20} />
                        ) : (
                            "Suggest Rounds"
                        )}
                    </Button>

                    {/* Show suggested rounds */}
                    <RoundSelector
                        suggestedRounds={suggestedRounds}
                        selectedRounds={selectedRounds}
                        onToggleRound={handleToggleRound}
                        onChangeMode={handleChangeMode}
                        onChangeCount={handleChangeCount}
                    />

                    <Button
                        type="submit"
                        variant="contained"
                        disabled={!isFormValid || selectedRounds.length === 0}
                    >
                        Start Interview
                    </Button>
                </Stack>
            </form>
            {null}

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
        </Paper>
    );
};

export default CreateInterviewPage;
