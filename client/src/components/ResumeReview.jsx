import { useEffect, useState } from "react";

// API / Context
import { useResumes } from "../hooks/useResumes";

// UI Components
import Alert from "@mui/material/Alert";
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
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

/**
 * ResumeReview
 * Reusable component to upload, select, and preview resumes.
 * Cloned from the upload and preview portion of CreateInterviewPage.
 *
 * Optional props:
 * - value: string (selected resumeId)
 * - onChange: function(resumeId: string)
 * - title: string (heading text)
 */
const ResumeReview = ({ value, onChange, title = "Resume Review" }) => {
    const { getResumes, deleteResume, uploadResume } = useResumes();

    const [resumes, setResumes] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [selectedResumeId, setSelectedResumeId] = useState(value || "");

    const [snack, setSnack] = useState({ open: false, severity: "info", message: "" });
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState("");

    useEffect(() => {
        const fetchResumes = async () => {
            const res = await getResumes();
            if (res) setResumes(res);
        };
        fetchResumes();
    }, [getResumes]);

    useEffect(() => {
        if (typeof value === "string") {
            setSelectedResumeId(value);
        }
    }, [value]);

    const handleLocalChange = (newId) => {
        setSelectedResumeId(newId);
        if (onChange) onChange(newId);
    };

    const handleUpload = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        try {
            setUploading(true);
            const newResume = await uploadResume(file);
            if (newResume) {
                setResumes((prev) => [...prev, newResume]);
                handleLocalChange(newResume._id);
                setSnack({ open: true, severity: "success", message: "Resume uploaded" });
            }
        } catch (err) {
            console.error("Upload failed", err);
            setSnack({ open: true, severity: "error", message: "Resume upload failed" });
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id) => {
        const ok = await deleteResume(id);
        if (ok) {
            setResumes((prev) => prev.filter((r) => r._id !== id));
            if (selectedResumeId === id) {
                handleLocalChange("");
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

    const selectedResume = resumes.find((r) => r._id === selectedResumeId);

    return (
        <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
                {title}
            </Typography>

            <Stack spacing={2}>
                <FormControl required error={!selectedResumeId}>
                    <Typography variant="subtitle1">Select Resume</Typography>

                    {/* Upload New Resume */}
                    <Box sx={{ my: 1 }}>
                        <Button variant="outlined" component="label" disabled={uploading}>
                            {uploading ? "Uploading..." : "Upload Resume (PDF)"}
                            <input type="file" hidden accept="application/pdf" onChange={handleUpload} />
                        </Button>
                    </Box>

                    {/* Or Choose Existing */}
                    {resumes.length > 0 && (
                        <TextField
                            select
                            label="Choose from existing resumes"
                            value={selectedResumeId}
                            onChange={(e) => handleLocalChange(e.target.value)}
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

                    {!selectedResumeId && (
                        <FormHelperText>Please select or upload a resume</FormHelperText>
                    )}
                </FormControl>

                {/* Quick inline preview trigger when something is selected */}
                {selectedResume && (
                    <Box>
                        <Button
                            variant="contained"
                            startIcon={<PictureAsPdfIcon />}
                            onClick={() => handlePreviewResume(selectedResume)}
                        >
                            Preview Selected Resume
                        </Button>
                    </Box>
                )}
            </Stack>

            {/* Notifications */}
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

export default ResumeReview;
