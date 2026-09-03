import { useContext, useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Chip, Container, Divider, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import api from "../api/axios";
import { OrganizationContext } from "../context/OrganizationContext";

const ROLE_LABELS = {
    owner: "Owner",
    admin: "Admin",
    recruiter: "Recruiter",
    hiring_manager: "Hiring manager",
    reviewer: "Reviewer",
};

const ASSIGNABLE_ROLES = ["admin", "recruiter", "hiring_manager", "reviewer"];

export default function HiringTeamPage() {
    const { activeOrganization, currentRole, organizations, selectOrganization, createOrganization, refreshOrganizations } = useContext(OrganizationContext);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("recruiter");
    const [organizationName, setOrganizationName] = useState("");
    const [adding, setAdding] = useState(false);
    const canManage = ["owner", "admin"].includes(currentRole);

    const loadMembers = async () => {
        if (!activeOrganization?._id) return;
        setLoading(true);
        setError("");
        try {
            const { data } = await api.get(`/organizations/${activeOrganization._id}/members`);
            setMembers(data?.members || []);
        } catch (err) {
            setError(err?.response?.data?.message || "Could not load team members");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMembers();
    }, [activeOrganization?._id]); // eslint-disable-line react-hooks/exhaustive-deps

    const memberCountLabel = useMemo(() => `${members.length} active member${members.length === 1 ? "" : "s"}`, [members.length]);

    const addMember = async (event) => {
        event.preventDefault();
        if (!email.trim()) return;
        setAdding(true);
        setError("");
        try {
            await api.post(`/organizations/${activeOrganization._id}/members`, { email: email.trim(), role });
            setEmail("");
            await loadMembers();
            await refreshOrganizations();
        } catch (err) {
            setError(err?.response?.data?.message || "Could not add team member");
        } finally {
            setAdding(false);
        }
    };

    const changeRole = async (membershipId, nextRole) => {
        setError("");
        try {
            await api.patch(`/organizations/${activeOrganization._id}/members/${membershipId}`, { role: nextRole });
            await loadMembers();
        } catch (err) {
            setError(err?.response?.data?.message || "Could not update role");
        }
    };

    const transferOwnership = async (membershipId) => {
        setError("");
        try {
            await api.post(`/organizations/${activeOrganization._id}/transfer-ownership`, { membershipId });
            await refreshOrganizations();
            await loadMembers();
        } catch (err) {
            setError(err?.response?.data?.message || "Could not transfer ownership");
        }
    };

    const removeMember = async (membershipId) => {
        setError("");
        try {
            await api.delete(`/organizations/${activeOrganization._id}/members/${membershipId}`);
            await loadMembers();
            await refreshOrganizations();
        } catch (err) {
            setError(err?.response?.data?.message || "Could not remove member");
        }
    };

    const createAnotherOrganization = async (event) => {
        event.preventDefault();
        if (organizationName.trim().length < 2) return;
        setError("");
        try {
            await createOrganization(organizationName.trim());
            setOrganizationName("");
        } catch (err) {
            setError(err?.response?.data?.message || "Could not create organization");
        }
    };

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
            <Stack spacing={4}>
                <Box>
                    <Typography variant="overline" color="primary.main" fontWeight={850}>Hiring</Typography>
                    <Typography component="h1" variant="h3" fontWeight={850} letterSpacing="-.035em">Team & organization</Typography>
                    <Typography color="text.secondary" mt={1}>Manage who can create assessments, review candidates, and administer your hiring workspace.</Typography>
                </Box>

                {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}

                <Paper variant="outlined" sx={{ p: 3, borderRadius: 4 }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ md: "center" }}>
                        <Box>
                            <Typography variant="h5" fontWeight={800}>{activeOrganization?.name}</Typography>
                            <Stack direction="row" spacing={1} mt={1} alignItems="center">
                                <Chip size="small" label={ROLE_LABELS[currentRole] || currentRole} color="primary" variant="outlined" />
                                <Typography variant="body2" color="text.secondary">{memberCountLabel}</Typography>
                            </Stack>
                        </Box>
                        {organizations.length > 1 && (
                            <FormControl size="small" sx={{ minWidth: 220 }}>
                                <InputLabel id="organization-select-label">Organization</InputLabel>
                                <Select labelId="organization-select-label" label="Organization" value={activeOrganization?._id || ""} onChange={(event) => selectOrganization(event.target.value)}>
                                    {organizations.map((organization) => <MenuItem key={organization._id} value={organization._id}>{organization.name}</MenuItem>)}
                                </Select>
                            </FormControl>
                        )}
                    </Stack>
                </Paper>

                <Paper variant="outlined" sx={{ p: 3, borderRadius: 4 }}>
                    <Typography variant="h5" fontWeight={800}>Members</Typography>
                    <Typography color="text.secondary" mt={.5}>Roles are scoped to this organization. Platform admin access remains separate.</Typography>
                    <Stack divider={<Divider flexItem />} mt={2}>
                        {members.map((membership) => {
                            const isOwner = membership.role === "owner";
                            return (
                                <Stack key={membership._id} direction={{ xs: "column", sm: "row" }} spacing={2} py={2} justifyContent="space-between" alignItems={{ sm: "center" }}>
                                    <Box minWidth={0}>
                                        <Typography fontWeight={750}>{membership.user?.name || membership.user?.email}</Typography>
                                        <Typography variant="body2" color="text.secondary">{membership.user?.email}</Typography>
                                    </Box>
                                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                        {canManage && !isOwner ? (
                                            <FormControl size="small" sx={{ minWidth: 160 }}>
                                                <Select value={membership.role} onChange={(event) => changeRole(membership._id, event.target.value)} aria-label={`Role for ${membership.user?.email}`}>
                                                    {ASSIGNABLE_ROLES.map((item) => <MenuItem key={item} value={item}>{ROLE_LABELS[item]}</MenuItem>)}
                                                </Select>
                                            </FormControl>
                                        ) : <Chip size="small" label={ROLE_LABELS[membership.role] || membership.role} />}
                                        {currentRole === "owner" && !isOwner && <Button size="small" onClick={() => transferOwnership(membership._id)}>Make owner</Button>}
                                        {canManage && !isOwner && <Button color="error" size="small" onClick={() => removeMember(membership._id)}>Remove</Button>}
                                    </Stack>
                                </Stack>
                            );
                        })}
                        {!loading && members.length === 0 && <Typography color="text.secondary" py={3}>No active members.</Typography>}
                    </Stack>
                </Paper>

                {canManage && (
                    <Paper component="form" variant="outlined" sx={{ p: 3, borderRadius: 4 }} onSubmit={addMember}>
                        <Typography variant="h5" fontWeight={800}>Add existing CompanionAI user</Typography>
                        <Typography color="text.secondary" mt={.5}>For now, the person must already have a CompanionAI account. Email invitations can be added later.</Typography>
                        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} mt={2}>
                            <TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required fullWidth />
                            <FormControl sx={{ minWidth: 190 }}>
                                <InputLabel id="new-member-role-label">Role</InputLabel>
                                <Select labelId="new-member-role-label" label="Role" value={role} onChange={(event) => setRole(event.target.value)}>
                                    {ASSIGNABLE_ROLES.map((item) => <MenuItem key={item} value={item}>{ROLE_LABELS[item]}</MenuItem>)}
                                </Select>
                            </FormControl>
                            <Button type="submit" variant="contained" disabled={adding}>{adding ? "Adding…" : "Add member"}</Button>
                        </Stack>
                    </Paper>
                )}

                <Paper component="form" variant="outlined" sx={{ p: 3, borderRadius: 4 }} onSubmit={createAnotherOrganization}>
                    <Typography variant="h5" fontWeight={800}>Create another organization</Typography>
                    <Typography color="text.secondary" mt={.5}>Useful if you hire for multiple companies or teams that need separate candidate data.</Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} mt={2}>
                        <TextField label="Organization name" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} fullWidth />
                        <Button type="submit" variant="outlined" disabled={organizationName.trim().length < 2}>Create</Button>
                    </Stack>
                </Paper>
            </Stack>
        </Container>
    );
}