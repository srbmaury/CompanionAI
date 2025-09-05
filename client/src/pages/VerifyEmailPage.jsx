import { useEffect, useState } from "react";
import { useSearchParams, Link as RouterLink, useNavigate } from "react-router-dom";
import { Box, Card, CardContent, Typography, Button, CircularProgress, Stack, Link } from "@mui/material";
import api from "../api/axios";

const VerifyEmailPage = () => {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const token = params.get("token");
    const email = params.get("email");
    const [status, setStatus] = useState("idle"); // idle | verifying | success | error
    const [message, setMessage] = useState("");

    useEffect(() => {
        const verify = async () => {
            if (!token || !email) {
                setStatus("error");
                setMessage("Invalid verification link");
                return;
            }
            setStatus("verifying");
            try {
                const { data } = await api.post(`/auth/verify-email`, { token, email });
                setStatus("success");
                setMessage(data?.message || "Email verified.");
            } catch (e) {
                const msg = e?.response?.data?.message || "Could not verify email.";
                setStatus("error");
                setMessage(msg);
            }
        };
        verify();
    }, [token, email]);

    const handleGoLogin = () => navigate("/login");

    return (
        <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", px: 2 }}>
            <Card sx={{ maxWidth: 640, width: "100%", borderRadius: 3 }}>
                <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
                    <Typography variant="h4" fontWeight={700} gutterBottom>
                        Email Verification
                    </Typography>
                    <Stack alignItems="center" spacing={3} sx={{ mt: 2 }}>
                        {status === "verifying" && (
                            <>
                                <CircularProgress />
                                <Typography>Verifying your email...</Typography>
                            </>
                        )}
                        {(status === "success" || status === "error") && (
                            <>
                                <Typography color={status === "error" ? "error" : "primary"}>{message}</Typography>
                                <Button variant="contained" onClick={handleGoLogin}>
                                    Go to Login
                                </Button>
                                {status === "error" && (
                                    <Typography variant="body2" color="text.secondary">
                                        Need a new link? <Link component={RouterLink} to="/register">Register again</Link> or contact support.
                                    </Typography>
                                )}
                            </>
                        )}
                    </Stack>
                </CardContent>
            </Card>
        </Box>
    );
};

export default VerifyEmailPage;
