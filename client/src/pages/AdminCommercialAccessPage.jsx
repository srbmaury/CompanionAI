import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Container,
    Divider,
    Grid,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import api from "../api/axios";

const planLabel = (plan) => ({
    none: "No access",
    trial: "Standard trial",
    design_partner: "Design partner",
    paid_pilot: "Paid pilot",
    starter: "Starter",
    growth: "Growth",
    enterprise: "Enterprise",
}[plan] || plan);

export default function AdminCommercialAccessPage() {
    const [users, setUsers] = useState([]);
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [q, setQ] = useState("");
    const [saving, setSaving] = useState("");
    const [grantOrgId, setGrantOrgId] = useState("");
    const [grantType, setGrantType] = useState("design_partner");
    const [candidateInterviews, setCandidateInterviews] = useState(10);
    const [validDays, setValidDays] = useState(30);
    const [note, setNote] = useState("");

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            const params = q.trim() ? { q: q.trim() } : {};
            const [usersResponse, organizationsResponse] = await Promise.all([
                api.get("/admin/users", { params }),
                api.get("/admin/organizations", { params }),
            ]);
            setUsers(usersResponse.data?.users || []);
            setOrganizations(organizationsResponse.data?.organizations || []);
        } catch (requestError) {
            setError(requestError?.response?.status === 403 ? "Administrator access is required." : requestError?.response?.data?.message || "Admin data could not be loaded.");
        } finally {
            setLoading(false);
        }
    }, [q]);

    useEffect(() => {
        const timer = setTimeout(load, 250);
        return () => clearTimeout(timer);
    }, [load]);

    const selectedOrganization = useMemo(
        () => organizations.find((organization) => organization._id === grantOrgId),
        [grantOrgId, organizations],
    );

    const setRole = async (user, role) => {
        setSaving(`user:${user._id}`);
        setError("");
        setMessage("");
        try {
            await api.patch(`/admin/users/${user._id}/role`, { role });
            setMessage(`${user.email} is now ${role === "admin" ? "an administrator" : "a standard user"}.`);
            await load();
        } catch (requestError) {
            setError(requestError?.response?.data?.message || "Could not change the user's role.");
        } finally {
            setSaving("");
        }
    };

    const openGrant = (organization, defaults = {}) => {
        setGrantOrgId(organization._id);
        setGrantType(defaults.type || "design_partner");
        setCandidateInterviews(defaults.candidateInterviews || 10);
        setValidDays(defaults.validDays || 30);
        setNote(defaults.note || "");
        setMessage("");
        setError("");
    };

    const grantAccess = async (event) => {
        event.preventDefault();
        if (!grantOrgId) return;
        setSaving(`org:${grantOrgId}`);
        setError("");
        setMessage("");
        try {
            const { data } = await api.post(`/admin/organizations/${grantOrgId}/hiring-grant`, {
                type: grantType,
                candidateInterviews: Number(candidateInterviews),
                validDays: Number(validDays),
                note: note.trim(),
            });
            setMessage(data?.message || "Hiring access granted.");
            setGrantOrgId("");
            await load();
        } catch (requestError) {
            setError(requestError?.response?.data?.message || "Could not grant Hiring access.");
        } finally {
            setSaving("");
        }
    };

    const revokeGrant = async (organization) => {
        setSaving(`org:${organization._id}`);
        setError("");
        setMessage("");
        try {
            await api.delete(`/admin/organizations/${organization._id}/hiring-grant`);
            setMessage(`Grant revoked for ${organization.name}.`);
            await load();
        } catch (requestError) {
            setError(requestError?.response?.data?.message || "Could not revoke Hiring access.");
        } finally {
            setSaving("");
        }
    };

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2} alignItems={{ md: "center" }}>
                <Box>
                    <Typography variant="overline" color="primary.main" fontWeight={850}>Admin</Typography>
                    <Typography component="h1" variant="h3" fontWeight={850}>Users & commercial access</Typography>
                    <Typography color="text.secondary" mt={1}>Manage platform administrators and founder-controlled Hiring trials, design-partner grants, and paid-pilot access.</Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button component={RouterLink} to="/admin/audit" variant="outlined">Audit</Button>
                    <Button component={RouterLink} to="/admin/calibration" variant="outlined">Calibration</Button>
                    <Button component={RouterLink} to="/admin/feedback" variant="outlined">Feedback</Button>
                </Stack>
            </Stack>

            <TextField
                fullWidth
                label="Search users or organizations"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                sx={{ my: 3 }}
            />
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
            {loading && <Typography color="text.secondary">Loading admin data…</Typography>}

            <Typography component="h2" variant="h5" fontWeight={850} mt={3}>Platform users</Typography>
            <Typography color="text.secondary" mt={.5} mb={2}>Admin is a platform-level role. It is separate from organization Owner/Admin roles inside CompanionAI Hire.</Typography>
            <Grid container spacing={2}>
                {users.map((user) => (
                    <Grid key={user._id} size={{ xs: 12, md: 6 }}>
                        <Card variant="outlined" sx={{ height: "100%" }}>
                            <CardContent>
                                <Stack direction="row" justifyContent="space-between" gap={2} alignItems="flex-start">
                                    <Box minWidth={0}>
                                        <Typography fontWeight={800}>{user.name}</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{user.email}</Typography>
                                        <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                                            <Chip size="small" label={user.role} color={user.role === "admin" ? "primary" : "default"} />
                                            <Chip size="small" label={user.provider} variant="outlined" />
                                            {!user.isVerified && <Chip size="small" label="Unverified" color="warning" variant="outlined" />}
                                        </Stack>
                                    </Box>
                                    <Button
                                        size="small"
                                        variant={user.role === "admin" ? "outlined" : "contained"}
                                        color={user.role === "admin" ? "warning" : "primary"}
                                        disabled={saving === `user:${user._id}`}
                                        onClick={() => setRole(user, user.role === "admin" ? "user" : "admin")}
                                    >
                                        {user.role === "admin" ? "Demote" : "Make admin"}
                                    </Button>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Divider sx={{ my: 4 }} />

            <Typography component="h2" variant="h5" fontWeight={850}>Hiring organizations</Typography>
            <Typography color="text.secondary" mt={.5} mb={2}>Use grants for founder-led design partners or manually approved exceptions. Standard Starter/Growth billing remains Stripe-managed.</Typography>
            <Stack spacing={2}>
                {organizations.map((organization) => (
                    <Card key={organization._id} variant="outlined">
                        <CardContent>
                            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
                                <Box>
                                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                        <Typography variant="h6" fontWeight={850}>{organization.name}</Typography>
                                        <Chip size="small" label={planLabel(organization.plan)} color={organization.accessType === "grant" ? "secondary" : organization.subscriptionPlan ? "primary" : "default"} />
                                        <Chip size="small" variant="outlined" label={`${organization.used} / ${organization.limit} used`} />
                                    </Stack>
                                    <Typography variant="body2" color="text.secondary" mt={.5}>
                                        Created by {organization.createdBy?.email || "unknown"}
                                        {organization.grant?.expiresAt ? ` · Grant expires ${new Date(organization.grant.expiresAt).toLocaleDateString()}` : ""}
                                    </Typography>
                                    {organization.grant?.note && <Typography variant="body2" mt={.75}>{organization.grant.note}</Typography>}
                                </Box>
                                <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                                    {!organization.subscriptionPlan && <Button size="small" variant="contained" onClick={() => openGrant(organization, { type: "design_partner", candidateInterviews: 10, validDays: 30, note: "Design partner" })}>Grant 10 free</Button>}
                                    {!organization.subscriptionPlan && <Button size="small" variant="outlined" onClick={() => openGrant(organization)}>Custom grant</Button>}
                                    {organization.grant && <Button size="small" color="error" disabled={saving === `org:${organization._id}`} onClick={() => revokeGrant(organization)}>Revoke</Button>}
                                </Stack>
                            </Stack>
                        </CardContent>
                    </Card>
                ))}
            </Stack>

            {selectedOrganization && (
                <Card variant="outlined" sx={{ mt: 3 }} component="form" onSubmit={grantAccess}>
                    <CardContent>
                        <Typography variant="h6" fontWeight={850}>Grant Hiring access — {selectedOrganization.name}</Typography>
                        <Grid container spacing={2} mt={.5}>
                            <Grid size={{ xs: 12, md: 3 }}>
                                <TextField select fullWidth label="Grant type" value={grantType} onChange={(event) => setGrantType(event.target.value)}>
                                    <MenuItem value="design_partner">Design partner (free)</MenuItem>
                                    <MenuItem value="paid_pilot">Paid pilot (manual)</MenuItem>
                                </TextField>
                            </Grid>
                            <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth type="number" label="Interviews" inputProps={{ min: 1, max: 1000 }} value={candidateInterviews} onChange={(event) => setCandidateInterviews(event.target.value)} /></Grid>
                            <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth type="number" label="Valid days" inputProps={{ min: 1, max: 365 }} value={validDays} onChange={(event) => setValidDays(event.target.value)} /></Grid>
                            <Grid size={{ xs: 12, md: 5 }}><TextField fullWidth label="Internal note" value={note} onChange={(event) => setNote(event.target.value)} /></Grid>
                        </Grid>
                        <Stack direction="row" spacing={1} mt={2}>
                            <Button type="submit" variant="contained" disabled={saving === `org:${grantOrgId}`}>Grant access</Button>
                            <Button onClick={() => setGrantOrgId("")}>Cancel</Button>
                        </Stack>
                    </CardContent>
                </Card>
            )}
        </Container>
    );
}
