import { useContext, useEffect, useRef, useState } from "react";
import { Alert, Box, CircularProgress, Container, Stack, Typography } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { setWorkspacePreference } from "../utils/workspacePreference";

export default function SsoCallbackPage() {
    const { search } = useLocation();
    const navigate = useNavigate();
    const { completeSsoLogin } = useContext(AuthContext);
    const started = useRef(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (started.current) return;
        started.current = true;
        const params = new URLSearchParams(search);
        const providerError = params.get("error");
        const exchangeCode = params.get("exchange");
        const organizationId = params.get("organization");
        if (providerError) {
            setError(providerError);
            return;
        }
        if (!exchangeCode) {
            setError("SSO sign-in could not be completed.");
            return;
        }
        completeSsoLogin(exchangeCode)
            .then((user) => {
                if (user?._id) {
                    setWorkspacePreference("hiring", user._id);
                    if (organizationId) {
                        try { localStorage.setItem(`companionai:organization:user:${user._id}`, organizationId); } catch { /* optional */ }
                    }
                }
                navigate("/assessments", { replace: true });
            })
            .catch((err) => setError(err?.response?.data?.message || "SSO sign-in failed."));
    }, [completeSsoLogin, navigate, search]);

    return (
        <Container maxWidth="sm" sx={{ py: 10 }}>
            <Box textAlign="center">
                {error ? <Alert severity="error">{error}</Alert> : (
                    <Stack spacing={2} alignItems="center">
                        <CircularProgress />
                        <Typography component="h1" variant="h5" fontWeight={800}>Completing work SSO sign-in…</Typography>
                        <Typography color="text.secondary">Verifying your organization access securely.</Typography>
                    </Stack>
                )}
            </Box>
        </Container>
    );
}
