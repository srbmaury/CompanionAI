import { useContext, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { Box, Card, CardContent, Link, Stack, Typography, TextField, Button, Alert } from "@mui/material";
import Captcha from "../components/Captcha";

const ForgotPasswordPage = () => {
    const { forgotPassword } = useContext(AuthContext);
    const [email, setEmail] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [captchaToken, setCaptchaToken] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const onSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setMessage("");
        setError("");
        try {
            const r = await forgotPassword(email, captchaToken);
            setMessage(r?.message || "If the email exists, a reset link has been sent");
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
                        Forgot Password
                    </Typography>
                    <Typography color="text.secondary" sx={{ mb: 3 }}>
                        Enter your registered email. We’ll send you a reset link if the account exists and is verified.
                    </Typography>
                    <form onSubmit={onSubmit}>
                        <Stack spacing={2}>
                            <TextField
                                type="email"
                                label="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                            <Captcha onVerify={(t) => setCaptchaToken(t)} onExpire={() => setCaptchaToken("")} />
                            <Button type="submit" variant="contained" disabled={submitting}>
                                {submitting ? "Sending..." : "Send reset link"}
                            </Button>
                            {message && <Alert severity="info">{message}</Alert>}
                            {error && <Alert severity="error">{error}</Alert>}
                            <Typography align="center" variant="body2">
                                <Link component={RouterLink} to="/login" underline="hover">
                                    Back to login
                                </Link>
                            </Typography>
                        </Stack>
                    </form>
                </CardContent>
            </Card>
        </Box>
    );
};

export default ForgotPasswordPage;
