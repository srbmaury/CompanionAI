import { useContext, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Button, CircularProgress, Container, Stack, Typography } from "@mui/material";
import api from "../api/axios";
import { AuthContext } from "../context/AuthContext";
import { getWorkspaceHome, getWorkspacePreference } from "../utils/workspacePreference";

export default function BillingSuccessPage() {
    const { user } = useContext(AuthContext);
    const [status, setStatus] = useState("checking");
    const [activePlan, setActivePlan] = useState("");
    const returnPath = getWorkspaceHome(getWorkspacePreference(user?._id) || "practice");
    useEffect(() => { let stopped = false; let attempts = 0; const check = async () => { try { const { data } = await api.get("/billing/entitlements"); if (["pro", "scale"].includes(data.plan)) { if (!stopped) { setActivePlan(data.plan); setStatus("active"); } return; } } catch { /* retry while webhook settles */ } attempts += 1; if (attempts >= 8) return !stopped && setStatus("pending"); setTimeout(check, 1500); }; check(); return () => { stopped = true; }; }, []);
    return <Container maxWidth="sm" sx={{ py: 10 }}><Stack spacing={3} alignItems="center" textAlign="center">
        {status === "checking" && <><CircularProgress /><Typography component="h1" variant="h4" fontWeight={850}>Confirming your subscription…</Typography><Typography color="text.secondary">Stripe completed checkout. We’re waiting for the signed webhook confirmation.</Typography></>}
        {status === "active" && <><Alert severity="success" sx={{ width: "100%" }}>{activePlan === "scale" ? "Scale" : "Pro"} is active on your account.</Alert><Typography component="h1" variant="h4" fontWeight={850}>Your upgraded limits are ready</Typography></>}
        {status === "pending" && <><Alert severity="info">Payment succeeded, but subscription confirmation is still processing. Refresh shortly or contact support if this persists.</Alert><Typography component="h1" variant="h4" fontWeight={850}>Confirmation pending</Typography></>}
        <Button component={RouterLink} to={returnPath} variant="contained">Continue to {returnPath === "/assessments" ? "Hiring" : "Practice"}</Button>
    </Stack></Container>;
}
