import { useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../context/AuthContext";

// MUI components
import {
    Alert,
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    Grid,
    IconButton,
    InputAdornment,
    MenuItem,
    Select,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";

// Icons
import {
    Add as AddIcon,
    Description as ResumeIcon,
    Delete,
    Download as DownloadIcon,
    Edit as EditIcon,
    PictureAsPdf as PdfIcon,
    Visibility,
    VisibilityOff,
} from "@mui/icons-material";

const ProfilePage = () => {
    const { user, getResumes, deleteResume, uploadResume, updateProfile, updateResume } =
        useContext(AuthContext);

    const [resumes, setResumes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [profileName, setProfileName] = useState("");
    const [preferredProgrammingLanguage, setPreferredProgrammingLanguage] = useState("cpp");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [profileMsg, setProfileMsg] = useState("");
    const [profileMsgOpen, setProfileMsgOpen] = useState(false);
    const [changePassword, setChangePassword] = useState(false);
    // Resumes controls
    const [sort, setSort] = useState("-createdAt");
    const [tagFilter, setTagFilter] = useState("");
    const [searchQ, setSearchQ] = useState("");
    // Edit dialog
    const [editOpen, setEditOpen] = useState(false);
    const [editId, setEditId] = useState(null);
    const [editName, setEditName] = useState("");
    const [editTags, setEditTags] = useState("");
    const [editNotes, setEditNotes] = useState("");
    const [savingResume, setSavingResume] = useState(false);
    // Preview dialog
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState("");

    const fileInputRef = useRef(null);

    const passwordPolicyError = (pwd) => {
        if (!pwd) return "Password is required";
        if (pwd.length < 8) return "Password must be at least 8 characters";
        if (!/[a-z]/.test(pwd)) return "Must include a lowercase letter";
        if (!/[A-Z]/.test(pwd)) return "Must include an uppercase letter";
        if (!/\d/.test(pwd)) return "Must include a digit";
        if (!/[^A-Za-z0-9]/.test(pwd)) return "Must include a special character";
        return "";
    };

    useEffect(() => {
        const fetchResumes = async () => {
            try {
                const data = await getResumes({ sort, tag: tagFilter || undefined, q: searchQ || undefined });
                setResumes(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error("Error fetching resumes:", err);
                setResumes([]);
            } finally {
                setLoading(false);
            }
        };
        fetchResumes();
    }, [getResumes, sort, tagFilter, searchQ]);

    useEffect(() => {
        setProfileName(user?.name || "");
        const ppl = user?.preferredProgrammingLanguage || "cpp";
        setPreferredProgrammingLanguage(ppl);
        try { localStorage.setItem("preferredProgrammingLanguage", ppl); } catch { /* ignore */ }
    }, [user]);

    const nameChanged = profileName.trim() !== (user?.name || "");
    const wantsPasswordChange = changePassword && newPassword.length > 0;
    const passwordMismatch = wantsPasswordChange && newPassword !== confirmPassword;
    const newPasswordInvalid = wantsPasswordChange && !!passwordPolicyError(newPassword);
    const needsCurrent = wantsPasswordChange && currentPassword.length === 0;
    const profileHasErrors = passwordMismatch || newPasswordInvalid || needsCurrent || profileName.trim().length === 0;
    const langChanged = preferredProgrammingLanguage !== (user?.preferredProgrammingLanguage || "cpp");
    const canSave = (nameChanged || wantsPasswordChange || langChanged) && !profileHasErrors && !saving;

    const handleDelete = async (id) => {
        try {
            setDeletingId(id);
            await deleteResume(id);
            setResumes((prev) => prev.filter((resume) => resume._id !== id));
        } catch (err) {
            console.error("Delete error:", err);
        } finally {
            setDeletingId(null);
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const allowed = [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ];
        const maxBytes = 10 * 1024 * 1024; // 10MB
        if (!allowed.includes(file.type)) {
            setProfileMsg("Unsupported file type");
            setProfileMsgOpen(true);
            e.target.value = "";
            return;
        }
        if (file.size > maxBytes) {
            setProfileMsg("File too large (max 10MB)");
            setProfileMsgOpen(true);
            e.target.value = "";
            return;
        }
        try {
            setUploading(true);
            const uploaded = await uploadResume(file);
            setResumes((prev) => [uploaded, ...prev]);
        } catch (err) {
            console.error("Upload error:", err);
        } finally {
            setUploading(false);
            e.target.value = ""; // reset input
        }
    };

    const openEdit = (res) => {
        setEditId(res._id);
        setEditName(res.fileName || "");
        setEditTags((res.tags || []).join(", "));
        setEditNotes(res.notes || "");
        setEditOpen(true);
    };

    const saveEdit = async () => {
        try {
            setSavingResume(true);
            const payload = {
                fileName: editName.trim(),
                tags: editTags
                    .split(",")
                    .map((t) => t.trim())
                    .filter((t) => t.length > 0),
                notes: editNotes,
            };
            const updated = await updateResume(editId, payload);
            setResumes((prev) => prev.map((r) => (r._id === editId ? updated : r)));
            setEditOpen(false);
            setProfileMsg("Resume updated");
            setProfileMsgOpen(true);
        } catch (e) {
            setProfileMsg(e?.response?.data?.message || "Update failed");
            setProfileMsgOpen(true);
        } finally {
            setSavingResume(false);
        }
    };

    const openPreview = (res) => {
        if (res.fileType !== "application/pdf") {
            setProfileMsg("Preview available for PDFs only");
            setProfileMsgOpen(true);
            return;
        }
        setPreviewUrl(`/api/resumes/${res._id}/preview`);
        setPreviewOpen(true);
    };

    return (
        <Box
            sx={(theme) => ({
                minHeight: "100vh",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                px: { xs: 1.5, sm: 3 },
                py: { xs: 3, sm: 5 },
                background:
                    theme.palette.mode === "dark"
                        ? `linear-gradient(135deg, ${theme.palette.background.default}, ${theme.palette.background.paper})`
                        : "linear-gradient(135deg, #f6f9ff 0%, #eef2ff 100%)",
            })}
        >
            <Card
                elevation={3}
                sx={{
                    width: "100%",
                    maxWidth: 960,
                    borderRadius: 3,
                    overflow: "hidden",
                    border: (t) => `1px solid ${t.palette.divider}`,
                }}
            >
                <CardContent sx={{ p: { xs: 3, sm: 4.5, md: 5.5 } }}>
                    {/* Profile Header */}
                    <Stack direction="row" alignItems="center" spacing={3} sx={{ pb: 1 }}>
                        <Avatar
                            sx={{
                                bgcolor: "primary.main",
                                width: 72,
                                height: 72,
                                fontSize: 28,
                            }}
                        >
                            {user?.name?.charAt(0) || "U"}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                            <Stack spacing={0.75}>
                                <TextField
                                    label="Name"
                                    value={profileName}
                                    onChange={(e) => setProfileName(e.target.value)}
                                    size="small"
                                    helperText={!profileName.trim() ? "Name is required" : " "}
                                    error={!profileName.trim()}
                                    
                                />
                                <Typography color="text.secondary" variant="body2">
                                    {user?.email || "user@example.com"}
                                </Typography>
                            </Stack>
                        </Box>
                        <Stack spacing={1} alignItems="flex-end" sx={{ minWidth: { xs: 260, sm: 320 } }}>
                            <FormControlLabel
                                control={<Switch checked={changePassword} onChange={(e) => {
                                    setChangePassword(e.target.checked);
                                    if (!e.target.checked) {
                                        setCurrentPassword("");
                                        setNewPassword("");
                                        setConfirmPassword("");
                                    }
                                }} />}
                                label="Change password"
                            />
                            {changePassword && (
                                <Stack spacing={1} sx={{ width: "100%" }}>
                                    <TextField
                                        label="Current password"
                                        type={showCurrent ? "text" : "password"}
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        size="small"
                                        error={needsCurrent}
                                        helperText={needsCurrent ? "Required" : " "}
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton onClick={() => setShowCurrent((s) => !s)} edge="end" aria-label="toggle current password visibility">
                                                        {showCurrent ? <VisibilityOff /> : <Visibility />}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                        }}
                                    />
                                    <TextField
                                        label="New password"
                                        type={showNew ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        size="small"
                                        error={newPasswordInvalid}
                                        helperText={newPassword ? (passwordPolicyError(newPassword) || " ") : " "}
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton onClick={() => setShowNew((s) => !s)} edge="end" aria-label="toggle new password visibility">
                                                        {showNew ? <VisibilityOff /> : <Visibility />}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                        }}
                                    />
                                    <TextField
                                        label="Confirm new password"
                                        type={showConfirm ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        size="small"
                                        error={passwordMismatch}
                                        helperText={passwordMismatch ? "Passwords do not match" : " "}
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton onClick={() => setShowConfirm((s) => !s)} edge="end" aria-label="toggle confirm password visibility">
                                                        {showConfirm ? <VisibilityOff /> : <Visibility />}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                        }}
                                    />
                                </Stack>
                            )}
                            <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => {
                                        setProfileName(user?.name || "");
                                        setCurrentPassword("");
                                        setNewPassword("");
                                        setConfirmPassword("");
                                        setChangePassword(false);
                                        const ppl = user?.preferredProgrammingLanguage || "cpp";
                                        setPreferredProgrammingLanguage(ppl);
                                    }}
                                >
                                    Reset
                                </Button>
                                <Button
                                    variant="contained"
                                    size="small"
                                    disabled={!canSave}
                                    onClick={async () => {
                                        try {
                                            setSaving(true);
                                            const payload = { name: profileName.trim(), preferredProgrammingLanguage };
                                            if (wantsPasswordChange) {
                                                payload.currentPassword = currentPassword;
                                                payload.newPassword = newPassword;
                                            }
                                            const r = await updateProfile(payload);
                                            setProfileMsg(r?.message || "Saved");
                                            setProfileMsgOpen(true);
                                            setCurrentPassword("");
                                            setNewPassword("");
                                            setConfirmPassword("");
                                            setChangePassword(false);
                                            try { localStorage.setItem("preferredProgrammingLanguage", preferredProgrammingLanguage); } catch { /* ignore */ }
                                        } catch (e) {
                                            setProfileMsg(e?.response?.data?.message || "Save failed");
                                            setProfileMsgOpen(true);
                                        } finally {
                                            setSaving(false);
                                        }
                                    }}
                                >
                                    {saving ? "Saving..." : "Save"}
                                </Button>
                            </Stack>
                        </Stack>
                    </Stack>
 
                     <Divider sx={{ my: 4 }} />
                     <Stack spacing={2} sx={{ maxWidth: 360 }}>
                         <Typography variant="h6" fontWeight={700}>Preferences</Typography>
                         <TextField
                             select
                             size="small"
                             label="Preferred programming language"
                             value={preferredProgrammingLanguage}
                             onChange={(e) => setPreferredProgrammingLanguage(e.target.value)}
                             helperText="Used as default in code editor"
                         >
                             <MenuItem value="javascript">JavaScript</MenuItem>
                             <MenuItem value="python">Python</MenuItem>
                             <MenuItem value="cpp">C++</MenuItem>
                             <MenuItem value="java">Java</MenuItem>
                         </TextField>
                     </Stack>
 
                     {/* Resumes Section */}
                     <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} sx={{ mt: 4 }}>
                         <Stack direction="row" spacing={2} alignItems="center">
                             <Typography variant="h6" fontWeight={700}>
                                 My Resumes
                             </Typography>
                             <TextField size="small" label="Search" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
                             <TextField size="small" label="Tag filter" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} />
                             <Select size="small" value={sort} onChange={(e) => setSort(e.target.value)}>
                                 <MenuItem value="-createdAt">Newest</MenuItem>
                                 <MenuItem value="createdAt">Oldest</MenuItem>
                                 <MenuItem value="fileName">Name A→Z</MenuItem>
                                 <MenuItem value="-fileName">Name Z→A</MenuItem>
                             </Select>
                         </Stack>
                         <Box>
                             <input
                                 type="file"
                                 accept=".pdf,.doc,.docx"
                                 ref={fileInputRef}
                                 onChange={handleFileChange}
                                 style={{ display: "none" }}
                             />
                             <Button
                                 variant="contained"
                                 startIcon={
                                     uploading ? (
                                         <CircularProgress
                                             size={20}
                                             color="inherit"
                                         />
                                     ) : (
                                         <AddIcon />
                                     )
                                 }
                                 disabled={uploading}
                                 sx={{
                                     borderRadius: 2,
                                     textTransform: "none",
                                     fontWeight: 600,
                                 }}
                                 onClick={handleUploadClick}
                             >
                                 {uploading ? "Uploading..." : "Upload Resume"}
                             </Button>
                         </Box>
                     </Stack>

                    {loading ? (
                        <Stack alignItems="center" py={4}>
                            <CircularProgress />
                        </Stack>
                    ) : resumes.length === 0 ? (
                        <Typography
                            color="text.secondary"
                            align="center"
                            py={4}
                        >
                            You don’t have any resumes yet. Start by uploading
                            one!
                        </Typography>
                    ) : (
                        <Grid container spacing={3}>
                            {resumes.map((resume) => (
                                <Grid
                                    item
                                    xs={12}
                                    sm={6}
                                    md={4}
                                    key={resume._id}
                                >
                                    <Card
                                        variant="outlined"
                                        sx={{
                                            borderRadius: 2,
                                            transition: "0.2s",
                                            "&:hover": { boxShadow: 4 },
                                        }}
                                    >
                                        <CardContent>
                                            <Stack spacing={2}>
                                                <ResumeIcon
                                                    fontSize="large"
                                                    color="primary"
                                                />
                                                <Typography
                                                    variant="subtitle1"
                                                    fontWeight={600}
                                                >
                                                    {resume.fileName ||
                                                        "Untitled Resume"}
                                                </Typography>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    {new Date(
                                                        resume.createdAt
                                                    ).toLocaleDateString()}
                                                </Typography>

                                                <Stack
                                                    direction="row"
                                                    spacing={1}
                                                    alignItems="center"
                                                >
                                                    <Tooltip title="Download">
                                                        <IconButton
                                                            color="primary"
                                                            size="small"
                                                            component="a"
                                                            href={resume.fileUrl}
                                                            download
                                                        >
                                                            <DownloadIcon />
                                                        </IconButton>
                                                    </Tooltip>

                                                    <Tooltip title="Preview PDF">
                                                        <span>
                                                            <IconButton
                                                                color="secondary"
                                                                size="small"
                                                                onClick={() => openPreview(resume)}
                                                                disabled={resume.fileType !== "application/pdf"}
                                                            >
                                                                <PdfIcon />
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>

                                                    <Tooltip title="Edit">
                                                        <IconButton
                                                            color="default"
                                                            size="small"
                                                            onClick={() => openEdit(resume)}
                                                        >
                                                            <EditIcon />
                                                        </IconButton>
                                                    </Tooltip>

                                                    <Tooltip title="Delete">
                                                        <span>
                                                            <IconButton
                                                                color="error"
                                                                size="small"
                                                                onClick={() => {
                                                                    if (window.confirm("Delete this resume?")) {
                                                                        handleDelete(resume._id);
                                                                    }
                                                                }}
                                                                disabled={
                                                                    deletingId ===
                                                                    resume._id
                                                                }
                                                            >
                                                                {deletingId ===
                                                                resume._id ? (
                                                                    <CircularProgress
                                                                        size={18}
                                                                        color="error"
                                                                    />
                                                                ) : (
                                                                    <Delete />
                                                                )}
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                </Stack>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    )}
                </CardContent>
            </Card>
            {profileMsgOpen && (
                <Alert
                    severity="info"
                    aria-live="polite"
                    sx={{ position: "fixed", top: 16, right: 16, zIndex: 1400 }}
                    onClose={() => setProfileMsgOpen(false)}
                >
                    {profileMsg}
                </Alert>
            )}

            {/* Edit resume dialog */}
            <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm" aria-labelledby="edit-resume-title">
                <DialogTitle id="edit-resume-title">Edit Resume</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label="File name"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            fullWidth
                        />
                        <TextField
                            label="Tags (comma separated)"
                            value={editTags}
                            onChange={(e) => setEditTags(e.target.value)}
                            fullWidth
                        />
                        <TextField
                            label="Notes"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            fullWidth
                            multiline
                            minRows={3}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditOpen(false)}>Cancel</Button>
                    <Button variant="contained" disabled={savingResume || !editName.trim()} onClick={saveEdit}>
                        {savingResume ? "Saving..." : "Save"}
                    </Button>
                </DialogActions>
            </Dialog>

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
        </Box>
    );
};

export default ProfilePage;
