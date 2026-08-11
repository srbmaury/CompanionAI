import { useEffect, useState } from "react";
import { Alert, Box, Card, CardContent, Container, LinearProgress, Skeleton, Stack, Typography } from "@mui/material";
import api from "../api/axios";

export default function ProgressPage() {
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    useEffect(() => { api.get("/interviews/analytics/progress").then(({ data: result }) => setData(result)).catch(() => setError("We couldn’t load your progress.")); }, []);
    return <Container maxWidth="md" sx={{ py: { xs: 3, md: 6 } }}>
        <Typography component="h1" variant="h3" fontWeight={850}>Your progress</Typography>
        <Typography color="text.secondary" mt={1} mb={4}>See how your interview performance changes across completed practice sessions.</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        {!data ? <Skeleton variant="rounded" height={220} /> : <>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={4}>
                {[{ label: "Sessions", value: data.total }, { label: "Completed", value: data.completed }, { label: "Average score", value: data.averageScore ? `${data.averageScore}/10` : "—" }, { label: "Recent change", value: data.improvement ? `${data.improvement > 0 ? "+" : ""}${data.improvement}` : "No change yet" }].map((item) => <Card key={item.label} variant="outlined" sx={{ flex: 1 }}><CardContent><Typography variant="h5" fontWeight={800}>{item.value}</Typography><Typography variant="body2" color="text.secondary">{item.label}</Typography></CardContent></Card>)}
            </Stack>
            <Typography component="h2" variant="h5" fontWeight={750} mb={2}>Recent scores</Typography>
            {data.recent?.length ? <Stack spacing={2}>{data.recent.map((item, index) => <Box key={`${item.date}-${index}`}><Stack direction="row" justifyContent="space-between"><Typography>{new Date(item.date).toLocaleDateString()}</Typography><Typography fontWeight={750}>{item.score}/10</Typography></Stack><LinearProgress variant="determinate" value={item.score * 10} sx={{ mt: .75, height: 9, borderRadius: 99 }} /></Box>)}</Stack> : <Alert severity="info">Complete an interview to start your progress history.</Alert>}
            {data.skills?.length > 0 && <Box mt={5}><Typography component="h2" variant="h5" fontWeight={750} mb={.5}>Skills by round</Typography><Typography color="text.secondary" mb={2}>Your lowest-scoring area is shown first so the next practice choice is obvious.</Typography><Stack spacing={2}>{data.skills.map((skill, index) => <Card variant="outlined" key={skill.name}><CardContent><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography fontWeight={750}>{skill.name}</Typography><Typography variant="caption" color="text.secondary">{skill.answers} evaluated answer{skill.answers === 1 ? "" : "s"}{index === 0 ? " · Recommended focus" : ""}</Typography></Box><Typography fontWeight={850}>{skill.score}/10</Typography></Stack><LinearProgress color={index === 0 ? "warning" : "primary"} variant="determinate" value={skill.score * 10} sx={{ mt: 1.25, height: 8, borderRadius: 99 }} /></CardContent></Card>)}</Stack></Box>}
        </>}
    </Container>;
}
