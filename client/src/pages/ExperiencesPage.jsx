import { useState } from "react";
import { Box, Button, Card, CardContent, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import api from "../api/axios";

const ExperiencesPage = () => {
    const [expCompany, setExpCompany] = useState("");
    const [expRole, setExpRole] = useState("");
    const [expLoading, setExpLoading] = useState(false);
    const [experiences, setExperiences] = useState([]);

    const fetchExperiences = async () => {
        if (!expCompany.trim() || !expRole.trim()) return;
        setExpLoading(true);
        try {
            const params = new URLSearchParams({ company: expCompany.trim(), role: expRole.trim() });
            const { data } = await api.get(`/experiences/search?${params.toString()}`);
            setExperiences(Array.isArray(data?.results) ? data.results : []);
        } catch {
            setExperiences([]);
        } finally {
            setExpLoading(false);
        }
    };

    return (
        <div style={{ padding: "2rem" }}>
            <Typography variant="h5" gutterBottom>
                Interview Experiences
            </Typography>
            <Box>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
                    <TextField size="small" label="Company" value={expCompany} onChange={(e) => setExpCompany(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") fetchExperiences(); }} sx={{ minWidth: 220 }} />
                    <TextField size="small" label="Role" value={expRole} onChange={(e) => setExpRole(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") fetchExperiences(); }} sx={{ minWidth: 220 }} />
                    <Button variant="contained" onClick={fetchExperiences} disabled={expLoading || !expCompany || !expRole}>
                        {expLoading ? "Searching..." : "Search"}
                    </Button>
                </Stack>
                <Stack spacing={2} sx={{ mt: 2 }}>
                    {expLoading ? (
                        <CircularProgress />
                    ) : experiences.length === 0 ? (
                        <Typography color="text.secondary">Enter company and role to find shared experiences.</Typography>
                    ) : (
                        experiences.map((item, idx) => (
                            <Card key={idx} variant="outlined">
                                <CardContent>
                                    <Typography variant="subtitle1" gutterBottom>{item.title || "Result"}</Typography>
                                    <Typography variant="body2" color="text.secondary" gutterBottom>{item.snippet}</Typography>
                                    <Button href={item.url} target="_blank" rel="noreferrer" size="small">Open</Button>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </Stack>
            </Box>
        </div>
    );
};

export default ExperiencesPage;
