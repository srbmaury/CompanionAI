import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Chip,
    Container,
    LinearProgress,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";
import api from "../api/axios";

const Metric = ({ label, value, helper }) => (
    <Paper variant="outlined" sx={{ p: 2.25, minHeight: 118 }}>
        <Typography variant="overline" color="text.secondary">{label}</Typography>
        <Typography variant="h4" fontWeight={850} mt={0.25}>{value}</Typography>
        {helper && <Typography variant="body2" color="text.secondary" mt={0.5}>{helper}</Typography>}
    </Paper>
);

const pct = (value) => `${Number(value || 0).toFixed(1)}%`;
const score = (value) => value == null ? "—" : Number(value).toFixed(1);

export default function AdminCalibrationPage() {
    const [data, setData] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        api.get("/admin/calibration")
            .then(({ data: response }) => { if (!cancelled) setData(response); })
            .catch((err) => { if (!cancelled) setError(err?.response?.data?.message || "Could not load calibration analytics."); });
        return () => { cancelled = true; };
    }, []);

    const transitions = useMemo(() => Object.entries(data?.decisions?.difficultyTransitions || {}).sort((a, b) => b[1] - a[1]), [data]);
    const decisions = useMemo(() => Object.entries(data?.reviewerAgreement?.byDecision || {}), [data]);

    if (error) return <Container maxWidth="lg" sx={{ py: 4 }}><Alert severity="error">{error}</Alert></Container>;
    if (!data) return <Container maxWidth="lg" sx={{ py: 4 }}><LinearProgress /></Container>;

    const adaptive = data.adaptive || {};
    const agreement = data.reviewerAgreement || {};

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Stack spacing={3}>
                <Box>
                    <Typography variant="h4" fontWeight={900}>AI interview calibration</Typography>
                    <Typography color="text.secondary" mt={0.75} maxWidth={850}>
                        Internal quality signals for adaptive Practice interviews and human-reviewed Hiring attempts. No candidate answers or resume text are included in this view.
                    </Typography>
                </Box>

                <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", lg: "repeat(4,1fr)" } }}>
                    <Metric label="Adaptive rounds" value={adaptive.rounds || 0} helper={`${adaptive.completed || 0} completed`} />
                    <Metric label="Avg. questions" value={score(adaptive.averageCompletedQuestions || adaptive.averageQuestions)} helper={`Early stop ${pct(adaptive.earlyStopRate)}`} />
                    <Metric label="Avg. coverage" value={pct(adaptive.averageCoverage)} helper={`Fallback questions ${pct(adaptive.fallbackQuestionRate)}`} />
                    <Metric label="Resume probing" value={pct(adaptive.resumeProbeRate)} helper={`${score(adaptive.averageFollowUpsPerQuestion)} follow-ups / question`} />
                </Box>

                <Box>
                    <Typography variant="h5" fontWeight={850} mb={1.5}>Human reviewer agreement</Typography>
                    <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", lg: "repeat(4,1fr)" } }}>
                        <Metric label="Reviewed pairs" value={agreement.reviewedPairs || 0} helper="AI score + human reviewer score" />
                        <Metric label="Mean absolute error" value={score(agreement.meanAbsoluteError)} helper="Lower is better" />
                        <Metric label="Within 1 point" value={pct(agreement.withinOnePoint)} helper={`Within 0.5: ${pct(agreement.withinHalfPoint)}`} />
                        <Metric label="Correlation" value={agreement.correlation == null ? "—" : agreement.correlation.toFixed(2)} helper={`Mean bias: ${score(agreement.meanBias)}`} />
                    </Box>
                </Box>

                <Paper variant="outlined" sx={{ p: 2.5 }}>
                    <Typography variant="h6" fontWeight={850}>Difficulty transitions</Typography>
                    <Typography variant="body2" color="text.secondary" mb={1.5}>Only actual difficulty changes are counted.</Typography>
                    <Stack direction="row" gap={1} flexWrap="wrap">
                        {transitions.length ? transitions.map(([transition, count]) => <Chip key={transition} label={`${transition} · ${count}`} />) : <Typography variant="body2" color="text.secondary">No transitions recorded yet.</Typography>}
                    </Stack>
                </Paper>

                {decisions.length > 0 && (
                    <Paper variant="outlined" sx={{ p: 2.5 }}>
                        <Typography variant="h6" fontWeight={850} mb={1.5}>Agreement by reviewer decision</Typography>
                        <Stack direction="row" gap={1} flexWrap="wrap">
                            {decisions.map(([decision, item]) => <Chip key={decision} label={`${decision}: ${item.count} · AI ${score(item.averageAiScore)} / human ${score(item.averageHumanScore)}`} />)}
                        </Stack>
                    </Paper>
                )}

                <Box>
                    <Typography variant="h5" fontWeight={850} mb={1.5}>Recent adaptive decision trace</Typography>
                    <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Time</TableCell>
                                    <TableCell>Event</TableCell>
                                    <TableCell>Target</TableCell>
                                    <TableCell>Difficulty</TableCell>
                                    <TableCell>Coverage</TableCell>
                                    <TableCell>Questions</TableCell>
                                    <TableCell>Source</TableCell>
                                    <TableCell>Version</TableCell>
                                    <TableCell>Reason</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {(data.recentTraces || []).map((trace, index) => (
                                    <TableRow key={`${trace.createdAt}-${index}`} hover>
                                        <TableCell sx={{ whiteSpace: "nowrap" }}>{trace.createdAt ? new Date(trace.createdAt).toLocaleString() : "—"}</TableCell>
                                        <TableCell>{trace.eventType}</TableCell>
                                        <TableCell>{trace.targetCompetency || "—"}</TableCell>
                                        <TableCell>{trace.difficultyFrom || "—"} → {trace.difficultyTo || "—"}</TableCell>
                                        <TableCell>{pct(trace.coverageBefore)} → {pct(trace.coverageAfter)}</TableCell>
                                        <TableCell>{trace.questionsAsked}/{trace.questionCount}</TableCell>
                                        <TableCell>
                                            <Stack direction="row" gap={0.5} flexWrap="wrap">
                                                {trace.sourceType && <Chip size="small" label={trace.sourceType} />}
                                                {trace.fallbackUsed && <Chip size="small" color="warning" label="fallback" />}
                                                {trace.usedResumeClaim && <Chip size="small" color="info" label="resume" />}
                                            </Stack>
                                        </TableCell>
                                        <TableCell sx={{ whiteSpace: "nowrap" }}>{trace.promptVersion || trace.engineVersion || "—"}</TableCell>
                                        <TableCell sx={{ minWidth: 260 }}>{trace.reason || "—"}</TableCell>
                                    </TableRow>
                                ))}
                                {!data.recentTraces?.length && <TableRow><TableCell colSpan={9}><Typography color="text.secondary">No adaptive trace events recorded yet.</Typography></TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>

                <Alert severity="info">
                    Provider/model request success, latency, token usage and adaptive prompt-purpose metrics remain in Prometheus so this dashboard does not duplicate high-volume telemetry in MongoDB.
                </Alert>
            </Stack>
        </Container>
    );
}
