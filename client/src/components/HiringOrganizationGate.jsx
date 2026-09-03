import { useContext, useState } from "react";
import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, TextField, Typography } from "@mui/material";
import { OrganizationContext } from "../context/OrganizationContext";

export default function HiringOrganizationGate({ children }) {
    const { activeOrganization, createOrganization, loading, error } = useContext(OrganizationContext);
    const [name, setName] = useState("");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState("");

    if (loading) {
        return <Box sx={{ minHeight: "55vh", display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
    }

    if (activeOrganization) return children;

    const create = async (event) => {
        event.preventDefault();
        if (name.trim().length < 2) return;
        setCreating(true);
        setCreateError("");
        try {
            await createOrganization(name.trim());
        } catch (err) {
            setCreateError(err?.response?.data?.message || err?.message || "Could not create organization");
        } finally {
            setCreating(false);
        }
    };

    return (
        <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 } }}>
            <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 }, borderRadius: 4 }}>
                <Stack component="form" spacing={2.5} onSubmit={create}>
                    <Box>
                        <Typography variant="overline" color="primary.main" fontWeight={850}>Hiring workspace</Typography>
                        <Typography component="h1" variant="h4" fontWeight={850} mt={.5}>Create your hiring organization</Typography>
                        <Typography color="text.secondary" mt={1}>Assessments, candidates, reports, and team permissions belong to an organization—not to an individual recruiter.</Typography>
                    </Box>
                    {(error || createError) && <Alert severity="error">{createError || error}</Alert>}
                    <TextField label="Organization name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Acme Engineering" required autoFocus />
                    <Button type="submit" variant="contained" size="large" disabled={creating || name.trim().length < 2}>{creating ? "Creating…" : "Create organization"}</Button>
                </Stack>
            </Paper>
        </Container>
    );
}
