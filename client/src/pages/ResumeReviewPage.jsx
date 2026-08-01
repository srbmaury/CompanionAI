import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { useResumes } from "../hooks/useResumes";

import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    IconButton,
    LinearProgress,
    FormControlLabel,
    Link,
    MenuItem,
    Paper,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DownloadIcon from "@mui/icons-material/Download";

export default function ResumeReviewPage() {
    const { getResumes, uploadResume } = useResumes();
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
    const [uploadConsent, setUploadConsent] = useState(false);

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
        <Container maxWidth="lg" sx={{ py: { xs: 3, sm: 5 } }}>
        <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 3 }}>
            <Typography component="h1" variant="h4" fontWeight={800}>AI resume review</Typography>
            <Typography color="text.secondary" sx={{ mt: .75, mb: 3 }}>Compare your resume with a target role and get focused, actionable improvements.</Typography>
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
                                    aria-label={`Download ${r.fileName || "resume"}`}
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
                                        aria-label={`Preview ${r.fileName || "resume"}`}
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
                <FormControlLabel
                    sx={{ alignItems: "flex-start", m: 0 }}
                    control={<Checkbox checked={uploadConsent} onChange={(event) => setUploadConsent(event.target.checked)} size="small" />}
                    label={<Typography variant="body2" color="text.secondary">I understand my resume is stored and processed to provide AI feedback. See the <Link href="/privacy">privacy notice</Link>.</Typography>}
                />
                <Button fullWidth variant="outlined" component="label" disabled={uploading || !uploadConsent}>
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
        </Container>
    );
}
