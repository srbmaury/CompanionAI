import { useContext, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { Box, Card, CardContent, Stack, Typography, TextField, Button, Alert, InputAdornment, IconButton } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import Captcha from "../components/Captcha";

const useQuery = () => new URLSearchParams(useLocation().search);

const ResetPasswordPage = () => {
    const { resetPassword } = useContext(AuthContext);
    const navigate = useNavigate();
    const query = useQuery();
    const token = query.get("token") || "";
    const email = query.get("email") || "";

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [captchaToken, setCaptchaToken] = useState("");

    const disabled = useMemo(() => {
        if (!newPassword || newPassword.length < 6) return true;
        if (newPassword !== confirmPassword) return true;
        return submitting;
    }, [newPassword, confirmPassword, submitting]);

    const onSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setMessage("");
        setError("");
        try {
            const r = await resetPassword({ token, email, newPassword, captchaToken });
            setMessage(r?.message || "Password updated");
            setTimeout(() => navigate("/login"), 1200);
        } catch (e) {
            setError(e?.response?.data?.message || "Something went wrong");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6, px: 2 }}>
            <Card sx={{ maxWidth: 520, width: "100%" }}>
                <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
                    <Typography variant="h5" fontWeight={700} gutterBottom>
                        Reset Password
                    </Typography>
                    <Typography color="text.secondary" sx={{ mb: 3 }}>
                        Set a new password for {email}.
                    </Typography>
                    <form onSubmit={onSubmit}>
                        <Stack spacing={2}>
                            <TextField
                                label="New password"
                                type={showNew ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                helperText={newPassword && newPassword.length < 6 ? "At least 6 characters" : " "}
                                error={!!newPassword && newPassword.length < 6}
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
                                required
                                helperText={confirmPassword && confirmPassword !== newPassword ? "Passwords do not match" : " "}
                                error={!!confirmPassword && confirmPassword !== newPassword}
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
                            <Captcha onVerify={(t) => setCaptchaToken(t)} onExpire={() => setCaptchaToken("")} />
                            <Button type="submit" variant="contained" disabled={disabled}>
                                {submitting ? "Saving..." : "Set new password"}
                            </Button>
                            {message && <Alert severity="success">{message}</Alert>}
                            {error && <Alert severity="error">{error}</Alert>}
                        </Stack>
                    </form>
                </CardContent>
            </Card>
        </Box>
    );
};

export default ResetPasswordPage;
