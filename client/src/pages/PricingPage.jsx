import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, Chip, Container, Grid, List, ListItem, ListItemText, Stack, Typography } from "@mui/material";
import { CheckCircleOutline } from "@mui/icons-material";
import api from "../api/axios";
import { trackEvent } from "../utils/analytics";

const plans = [
    { id: "free", name: "Free", description: "Build a consistent practice habit.", features: ["Progress tracking", "Practice reminders"] },
    { id: "pro", name: "Pro", description: "Practice and assess candidates without the free-plan ceiling.", features: ["All interview formats", "Billing management and invoices"] },
    { id: "scale", name: "Scale", description: "High-capacity usage for active hiring teams and intensive preparation.", features: ["Highest monthly capacity", "All Pro capabilities", "Billing management and invoices"] },
];

export default function PricingPage() {
    const [params] = useSearchParams();
    const [entitlements, setEntitlements] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const priceLabel = (plan) => { const price = entitlements?.prices?.[plan] || (plan === "pro" ? entitlements?.proPrice : null); return price ? new Intl.NumberFormat(undefined, { style: "currency", currency: price.currency.toUpperCase() }).format(price.unitAmount / 100) : null; };
    const intervalLabel = (plan) => { const price = entitlements?.prices?.[plan] || (plan === "pro" ? entitlements?.proPrice : null); return price?.intervalCount > 1 ? `${price.intervalCount} ${price.interval}s` : price?.interval; };
    useEffect(() => { trackEvent("pricing_viewed"); api.get("/billing/entitlements").then(({ data }) => setEntitlements(data)).catch(() => setError("Could not load your plan.")); }, []);
    const redirect = async (endpoint, body) => { try { setLoading(true); setError(""); if (endpoint.includes("checkout")) trackEvent("checkout_started", body); const { data } = await api.post(endpoint, body); if (!data?.url) throw new Error("Missing billing URL"); window.location.assign(data.url); } catch (e) { setError(e?.response?.data?.message || "Billing could not be opened."); setLoading(false); } };
    return <Container maxWidth="lg" sx={{ py: { xs: 4, md: 7 } }}>
        <Stack alignItems="center" textAlign="center" mb={4}><Typography variant="overline" color="primary.main" fontWeight={850}>Simple plans</Typography><Typography component="h1" variant="h3" fontWeight={850}>Practice at the pace you need</Typography><Typography color="text.secondary" mt={1}>Checkout is securely hosted by Stripe. Pricing below is read directly from the configured Stripe product.</Typography></Stack>
        {params.get("checkout") === "cancelled" && <Alert severity="info" sx={{ mb: 3 }}>Checkout was canceled. Nothing was charged.</Alert>}
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        <Grid container spacing={3}>{plans.map((plan) => { const fallbacks = { free: { interviews: 3, resumeReviews: 3, assessments: 2 }, pro: { interviews: 100, resumeReviews: 100, assessments: 50 }, scale: { interviews: 1000, resumeReviews: 1000, assessments: 500 } }; const planLimits = entitlements?.planLimits?.[plan.id] || (plan.id === entitlements?.plan ? entitlements?.limits : fallbacks[plan.id]); const features = [`${planLimits.interviews} practice interviews each month`, `${planLimits.resumeReviews} resume reviews each month`, `${planLimits.assessments} candidate assessments each month`, ...plan.features]; const price = priceLabel(plan.id); const current = plan.id === entitlements?.plan; const checkoutAvailable = Boolean(entitlements?.billingAvailable?.[plan.id]); return <Grid size={{ xs: 12, md: 4 }} key={plan.id}><Card variant="outlined" sx={{ height: "100%", borderColor: plan.id === "scale" ? "secondary.main" : plan.id === "pro" ? "primary.main" : "divider", display: "flex" }}><CardContent sx={{ p: 3, display: "flex", flexDirection: "column", width: "100%" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}><Typography variant="h4" fontWeight={850}>{plan.name}</Typography>{plan.id === "pro" && <Chip label="Most popular" color="primary" />}{plan.id === "scale" && <Chip label="Highest limits" color="secondary" />}</Stack>{plan.id !== "free" && price && <Typography variant="h5" fontWeight={800} mt={1}>{price}<Typography component="span" color="text.secondary" fontSize="1rem"> / {intervalLabel(plan.id)}</Typography></Typography>}<Typography color="text.secondary" mt={1}>{plan.description}</Typography>
            <List>{features.map((feature) => <ListItem key={feature} disableGutters><CheckCircleOutline color="success" sx={{ mr: 1.5 }} /><ListItemText primary={feature} /></ListItem>)}</List>
            <Box mt="auto" pt={2}>{current ? <Button fullWidth variant="contained" disabled>Current plan</Button> : plan.id === "free" ? <Button fullWidth variant="outlined" disabled>Included access</Button> : entitlements?.plan !== "free" ? <Button fullWidth variant="outlined" disabled={loading} onClick={() => redirect("/billing/portal-session")}>Change in billing portal</Button> : <Button fullWidth variant="contained" color={plan.id === "scale" ? "secondary" : "primary"} disabled={loading || !checkoutAvailable} onClick={() => redirect("/billing/checkout-session", { plan: plan.id })}>{loading ? "Opening checkout…" : checkoutAvailable ? `Choose ${plan.name}` : "Checkout not configured"}</Button>}</Box>
        </CardContent></Card></Grid>; })}</Grid>
        {["pro", "scale"].includes(entitlements?.plan) && <Stack alignItems="center" mt={3}><Button onClick={() => redirect("/billing/portal-session")} disabled={loading}>Manage billing, invoices, plan changes, or cancellation</Button></Stack>}
    </Container>;
}
