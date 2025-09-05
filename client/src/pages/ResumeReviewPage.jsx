import { useContext, useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { AuthContext } from "../context/AuthContext";

import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    IconButton,
    LinearProgress,
    MenuItem,
    Paper,
    Snackbar,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DownloadIcon from "@mui/icons-material/Download";

export default function ResumeReviewPage() {
    const { getResumes, uploadResume } = useContext(AuthContext);
    const [resumes, setResumes] = useState([]);
    const [resumeId, setResumeId] = useState("");
    const [uploading, setUploading] = useState(false);
    const [loadingReview, setLoadingReview] = useState(false);
    const [role, setRole] = useState("");
    const [jobDescription, setJobDescription] = useState("");
    const [snack, setSnack] = useState({ open: false, severity: "info", message: "" });
    const [review, setReview] = useState(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState("");

    useEffect(() => {
        const fetchResumes = async () => {
            const res = await getResumes();
            if (Array.isArray(res)) setResumes(res);
        };
        fetchResumes();
    }, [getResumes]);

    const selected = useMemo(() => resumes.find((r) => r._id === resumeId), [resumes, resumeId]);

    const handleUpload = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
            setUploading(true);
            const newResume = await uploadResume(file);
            if (newResume) {
                setResumes((prev) => [...prev, newResume]);
                setResumeId(newResume._id);
                setSnack({ open: true, severity: "success", message: "Resume uploaded" });
            }
        } catch {
            setSnack({ open: true, severity: "error", message: "Upload failed" });
        } finally {
            setUploading(false);
        }
    };

    // Allow role and jobDescription to be optional
    const isReady = Boolean(resumeId);

    const requestReview = async () => {
        if (!isReady) return;
        setLoadingReview(true);
        setReview(null);
        try {
            const { data } = await api.post(`/resumes/${resumeId}/review`, { role, jobDescription });
            setReview(data);
        } catch (error) {
            setSnack({ open: true, severity: "error", message: error?.response?.data?.message || "Review failed" });
        } finally {
            setLoadingReview(false);
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

    return (
        <Paper sx={{ p: 3, maxWidth: 1000, mx: "auto", mt: 4 }}>
            <Typography variant="h5" gutterBottom>
                AI Resume Review
            </Typography>

            <Stack spacing={2}>
                {resumes.length > 0 && (
                    <TextField
                        fullWidth
                        select
                        label="Choose Resume"
                        value={resumeId}
                        onChange={(e) => setResumeId(e.target.value)}
                        helperText={!resumeId ? "Upload or select a resume" : ""}
                        required
                    >
                        {resumes.map((r) => (
                            <MenuItem key={r._id} value={r._id}>
                                {r.fileName || "Untitled Resume"} — {new Date(r.createdAt).toLocaleDateString()}
                                <IconButton
                                    color="primary"
                                    size="small"
                                    component="a"
                                    href={r.fileUrl}
                                    download
                                    onMouseDown={(e) => e.stopPropagation()}
                                    sx={{ ml: 1 }}
                                >
                                    <DownloadIcon />
                                </IconButton>
                                {r.fileType === "application/pdf" && (
                                    <IconButton
                                        color="primary"
                                        size="small"
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handlePreviewResume(r);
                                        }}
                                        sx={{ ml: 0.5 }}
                                    >
                                        <PictureAsPdfIcon />
                                    </IconButton>
                                )}
                            </MenuItem>
                        ))}
                    </TextField>
                )}
                <Button fullWidth variant="outlined" component="label" disabled={uploading}>
                    {uploading ? "Uploading..." : "Upload Resume (PDF)"}
                    <input type="file" hidden accept="application/pdf" onChange={handleUpload} />
                </Button>

                <TextField fullWidth label="Target Role" value={role} onChange={(e) => setRole(e.target.value)} />
                <TextField
                    fullWidth
                    label="Job Description"
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    multiline
                    rows={6}
                />
                <Button fullWidth variant="contained" disabled={!isReady || loadingReview} onClick={requestReview}>
                    {loadingReview ? "Analyzing..." : "Generate AI Review"}
                </Button>
                {loadingReview && <LinearProgress />}
            </Stack>

            {/* Analysis section below inputs */}
            {!review ? (
                <Box sx={{ p: 2, color: "text.secondary" }}>
                    <Typography variant="subtitle1">Your AI review will appear here</Typography>
                    {selected && selected.fileType === "application/pdf" && (
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                            <PictureAsPdfIcon fontSize="small" />
                            <Typography variant="body2">Selected: {selected.fileName}</Typography>
                        </Stack>
                    )}
                </Box>
            ) : (
                <Box sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                        Summary & ATS fit: {review.atsScore}%
                    </Typography>
                    <Typography sx={{ whiteSpace: "pre-wrap" }}>{review.summary}</Typography>
                    <Divider sx={{ my: 2 }} />
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <Typography variant="subtitle1">Strengths</Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                                {(review.strengths || []).map((s, i) => (
                                    <Chip key={i} label={s} color="success" variant="outlined" sx={{ mr: 1, mb: 1 }} />
                                ))}
                            </Stack>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Typography variant="subtitle1">Gaps</Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                                {(review.gaps || []).map((s, i) => (
                                    <Chip key={i} label={s} color="warning" variant="outlined" sx={{ mr: 1, mb: 1 }} />
                                ))}
                            </Stack>
                        </Grid>
                        <Grid item xs={12}>
                            <Typography variant="subtitle1">Matched Keywords</Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                                {(review.keywordsMatched || []).map((s, i) => (
                                    <Chip key={i} label={s} variant="outlined" sx={{ mr: 1, mb: 1 }} />
                                ))}
                            </Stack>
                        </Grid>
                        <Grid item xs={12}>
                            <Typography variant="subtitle1">Improvement Suggestions</Typography>
                            <Stack spacing={1}>
                                {(review.improvementSuggestions || []).map((s, i) => (
                                    <Typography key={i}>• {s}</Typography>
                                ))}
                            </Stack>
                        </Grid>
                        {review.roleAlignment ? (
                            <Grid item xs={12}>
                                <Typography variant="subtitle1">Role Alignment</Typography>
                                <Typography sx={{ whiteSpace: "pre-wrap" }}>{review.roleAlignment}</Typography>
                            </Grid>
                        ) : null}
                    </Grid>
                </Box>
            )}

            <Snackbar
                open={snack.open}
                autoHideDuration={3000}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.severity} sx={{ width: "100%" }}>
                    {snack.message}
                </Alert>
            </Snackbar>

            {/* PDF preview dialog */}
            <Dialog
                open={previewOpen}
                onClose={() => setPreviewOpen(false)}
                fullWidth
                maxWidth="xl"
                PaperProps={{ sx: { height: "92vh" } }}
            >
                <DialogTitle>Preview</DialogTitle>
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
}
