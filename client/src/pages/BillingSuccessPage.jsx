import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Button, CircularProgress, Container, Stack, Typography } from "@mui/material";
import api from "../api/axios";

export default function BillingSuccessPage() {
    const [status, setStatus] = useState("checking");
    useEffect(() => { let stopped = false; let attempts = 0; const check = async () => { try { const { data } = await api.get("/billing/entitlements"); if (data.plan === "pro") return !stopped && setStatus("active"); } catch { /* retry while webhook settles */ } attempts += 1; if (attempts >= 8) return !stopped && setStatus("pending"); setTimeout(check, 1500); }; check(); return () => { stopped = true; }; }, []);
    return <Container maxWidth="sm" sx={{ py: 10 }}><Stack spacing={3} alignItems="center" textAlign="center">
        {status === "checking" && <><CircularProgress /><Typography variant="h4" fontWeight={850}>Confirming your subscription…</Typography><Typography color="text.secondary">Stripe completed checkout. We’re waiting for the signed webhook confirmation.</Typography></>}
        {status === "active" && <><Alert severity="success" sx={{ width: "100%" }}>Pro is active on your account.</Alert><Typography variant="h4" fontWeight={850}>You’re ready to practice</Typography></>}
        {status === "pending" && <><Alert severity="info">Payment succeeded, but subscription confirmation is still processing. Refresh shortly or contact support if this persists.</Alert><Typography variant="h4" fontWeight={850}>Confirmation pending</Typography></>}
        <Button component={RouterLink} to="/dashboard" variant="contained">Return to dashboard</Button>
    </Stack></Container>;
}
