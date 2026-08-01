import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, Chip, Container, Grid, List, ListItem, ListItemText, Stack, Typography } from "@mui/material";
import { CheckCircleOutline } from "@mui/icons-material";
import api from "../api/axios";
import { trackEvent } from "../utils/analytics";

const plans = [
    { id: "free", name: "Free", description: "Build a consistent practice habit.", features: ["3 interview sessions each month", "3 resume reviews each month", "Progress tracking", "Practice reminders"] },
    { id: "pro", name: "Pro", description: "Practice deeply without the free-plan ceiling.", features: ["100 interview sessions each month", "100 resume reviews each month", "All interview formats", "Billing management and invoices"] },
];

export default function PricingPage() {
    const [params] = useSearchParams();
    const [entitlements, setEntitlements] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const priceLabel = entitlements?.proPrice ? new Intl.NumberFormat(undefined, { style: "currency", currency: entitlements.proPrice.currency.toUpperCase() }).format(entitlements.proPrice.unitAmount / 100) : null;
    const intervalLabel = entitlements?.proPrice?.intervalCount > 1 ? `${entitlements.proPrice.intervalCount} ${entitlements.proPrice.interval}s` : entitlements?.proPrice?.interval;
    useEffect(() => { trackEvent("pricing_viewed"); api.get("/billing/entitlements").then(({ data }) => setEntitlements(data)).catch(() => setError("Could not load your plan.")); }, []);
    const redirect = async (endpoint) => { try { setLoading(true); setError(""); if (endpoint.includes("checkout")) trackEvent("checkout_started"); const { data } = await api.post(endpoint); if (!data?.url) throw new Error("Missing billing URL"); window.location.assign(data.url); } catch (e) { setError(e?.response?.data?.message || "Billing could not be opened."); setLoading(false); } };
    return <Container maxWidth="md" sx={{ py: { xs: 4, md: 7 } }}>
        <Stack alignItems="center" textAlign="center" mb={4}><Typography variant="overline" color="primary.main" fontWeight={850}>Simple plans</Typography><Typography component="h1" variant="h3" fontWeight={850}>Practice at the pace you need</Typography><Typography color="text.secondary" mt={1}>Checkout is securely hosted by Stripe. Pricing below is read directly from the configured Stripe product.</Typography></Stack>
        {params.get("checkout") === "cancelled" && <Alert severity="info" sx={{ mb: 3 }}>Checkout was canceled. Nothing was charged.</Alert>}
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        <Grid container spacing={3}>{plans.map((plan) => <Grid size={{ xs: 12, md: 6 }} key={plan.id}><Card variant="outlined" sx={{ height: "100%", borderColor: plan.id === "pro" ? "primary.main" : "divider" }}><CardContent sx={{ p: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h4" fontWeight={850}>{plan.name}</Typography>{plan.id === "pro" && <Chip label="For serious practice" color="primary" />}</Stack>{plan.id === "pro" && priceLabel && <Typography variant="h5" fontWeight={800} mt={1}>{priceLabel}<Typography component="span" color="text.secondary" fontSize="1rem"> / {intervalLabel}</Typography></Typography>}<Typography color="text.secondary" mt={1}>{plan.description}</Typography>
            <List>{plan.features.map((feature) => <ListItem key={feature} disableGutters><CheckCircleOutline color="success" sx={{ mr: 1.5 }} /><ListItemText primary={feature} /></ListItem>)}</List>
            <Box mt={2}>{plan.id === "free" ? <Button fullWidth variant="outlined" disabled>Current free access</Button> : entitlements?.plan === "pro" ? <Button fullWidth variant="contained" disabled>Current plan</Button> : <Button fullWidth variant="contained" disabled={loading || !entitlements?.billingAvailable} onClick={() => redirect("/billing/checkout-session")}>{loading ? "Opening checkout…" : entitlements?.billingAvailable ? "Upgrade securely" : "Checkout not configured"}</Button>}</Box>
        </CardContent></Card></Grid>)}</Grid>
        {entitlements?.plan === "pro" && <Stack alignItems="center" mt={3}><Button onClick={() => redirect("/billing/portal-session")} disabled={loading}>Manage billing, invoices, or cancellation</Button></Stack>}
    </Container>;
}
