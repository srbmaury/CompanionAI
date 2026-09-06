import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
    AddRounded,
    AssignmentTurnedInRounded,
    ContentCopyRounded,
    ErrorOutlineRounded,
    GroupsRounded,
    HourglassTopRounded,
    InsightsRounded,
    TaskAltRounded,
} from "@mui/icons-material";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Container,
    Divider,
    Grid,
    MenuItem,
    Pagination,
    Paper,
    Skeleton,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import api from "../api/axios";
import { OrganizationContext } from "../context/OrganizationContext";
import { useNotify } from "../context/NotificationContext";
import { hiringPermissionsFor } from "../utils/hiringPermissions";
import { trackEvent } from "../utils/analytics";

const candidateStatusLabel = (status) => {
    if (status === "submitted") return "Submitted";
    if (status === "evaluating") return "Evaluating";
    if (status === "evaluation_failed") return "Needs retry";
    return "In progress";
};

const candidateStatusColor = (status) => {
    if (status === "submitted") return "success";
    if (status === "evaluation_failed") return "error";
    return "warning";
};

export default function HiringWorkspacePage() {
    const location = useLocation();
    const navigate = useNavigate();
    const notify = useNotify();
    const { currentRole, activeOrganization, loading: organizationLoading } = useContext(OrganizationContext);
    const permissions = hiringPermissionsFor(currentRole);
    const [overview, setOverview] = useState({ summary: {}, assessments: [], candidates: [], totalPages: 1 });
    const [items, setItems] = useState([]);
    const [overviewLoading, setOverviewLoading] = useState(true);
    const [assessmentsLoading, setAssessmentsLoading] = useState(true);
    const [candidatePage, setCandidatePage] = useState(1);
    const [assessmentPage, setAssessmentPage] = useState(1);
    const [assessmentPages, setAssessmentPages] = useState(1);
    const [candidateSearch, setCandidateSearch] = useState("");
    const [candidateStatus, setCandidateStatus] = useState("");
    const [candidateAssessment, setCandidateAssessment] = useState("");
    const [error, setError] = useState("");

    const requestedView = location.hash === "#candidate-pipeline"
        ? "candidates"
        : location.hash === "#assessment-list"
            ? "assessments"
            : "overview";
    const view = requestedView === "overview" && !permissions.canViewOverview
        ? "candidates"
        : requestedView === "assessments" && !permissions.canViewAssessments
            ? "candidates"
            : requestedView;

    const loadOverview = useCallback(async () => {
        if (!activeOrganization?._id || !permissions.canViewCandidatePipeline) {
            setOverview({ summary: {}, assessments: [], candidates: [], totalPages: 1 });
            setOverviewLoading(false);
            return;
        }
        setOverviewLoading(true);
        try {
            const { data } = await api.get("/assessments/overview", {
                params: {
                    page: candidatePage,
                    limit: 8,
                    search: candidateSearch || undefined,
                    status: candidateStatus || undefined,
                    assessmentId: candidateAssessment || undefined,
                },
            });
            setOverview({
                summary: data.summary || {},
                assessments: data.assessments || [],
                candidates: data.candidates || [],
                totalPages: data.totalPages || 1,
            });
        } catch {
            setError("We couldn’t load the candidate pipeline. Try again in a moment.");
        } finally {
            setOverviewLoading(false);
        }
    }, [activeOrganization?._id, candidateAssessment, candidatePage, candidateSearch, candidateStatus, permissions.canViewCandidatePipeline]);

    const loadAssessments = useCallback(async () => {
        if (!activeOrganization?._id || !permissions.canViewAssessments) {
            setItems([]);
            setAssessmentPages(1);
            setAssessmentsLoading(false);
            return;
        }
        setAssessmentsLoading(true);
        try {
            const { data } = await api.get("/assessments", { params: { page: assessmentPage, limit: 8 } });
            setItems(data.items || []);
            setAssessmentPages(data.totalPages || 1);
        } catch {
            setError("We couldn’t load your assessments. Try again in a moment.");
        } finally {
            setAssessmentsLoading(false);
        }
    }, [activeOrganization?._id, assessmentPage, permissions.canViewAssessments]);

    useEffect(() => {
        setCandidatePage(1);
        setAssessmentPage(1);
        setCandidateSearch("");
        setCandidateStatus("");
        setCandidateAssessment("");
        setError("");
    }, [activeOrganization?._id]);

    useEffect(() => {
        const timer = window.setTimeout(loadOverview, candidateSearch ? 250 : 0);
        return () => window.clearTimeout(timer);
    }, [candidateSearch, loadOverview]);

    useEffect(() => { loadAssessments(); }, [loadAssessments]);
    useEffect(() => { trackEvent("hiring_workspace_viewed", { view }); }, [view]);

    const attentionCandidates = useMemo(
        () => (overview.candidates || []).filter((candidate) => ["submitted", "evaluation_failed"].includes(candidate.status)).slice(0, 4),
        [overview.candidates],
    );
    const needsAttentionCount = Number(overview.summary.invitationFailed || 0) + attentionCandidates.length;

    const copyLink = async (token) => {
        try {
            await navigator.clipboard.writeText(`${window.location.origin}/assessment/${token}`);
            notify("Candidate link copied.", "success");
        } catch {
            notify("Candidate link could not be copied.", "error");
        }
    };

    if (organizationLoading) return <Stack minHeight="50vh" alignItems="center" justifyContent="center"><CircularProgress /></Stack>;
    if (!activeOrganization) return <Navigate to="/hire/team" replace />;

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 3, md: 6 } }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "flex-start" }} gap={2} mb={4}>
                <Box>
                    <Typography variant="overline" color="primary.main" fontWeight={850}>Evalcue AI Hire · {activeOrganization.name}</Typography>
                    <Typography component="h1" variant="h3" sx={{ fontSize: { xs: "2.4rem", sm: "3rem" } }} fontWeight={850} letterSpacing="-.035em">Hiring workspace</Typography>
                    <Typography color="text.secondary" mt={1}>See what needs attention, review candidate evidence, and manage assessments without mixing those tasks with assessment construction.</Typography>
                </Box>
                {permissions.canManageAssessments && <Button variant="contained" size="large" startIcon={<AddRounded />} onClick={() => navigate("/hire/assessments/new")} sx={{ flexShrink: 0 }}>New assessment</Button>}
            </Stack>

            {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError("")}>{error}</Alert>}

            {permissions.canViewOverview && view === "overview" && <>
                <Typography component="h2" variant="h5" fontWeight={850} mb={2}>Overview</Typography>
                <Grid container spacing={2} mb={3}>
                    {[
                        [<ErrorOutlineRounded key="i" />, "Needs attention", overviewLoading ? null : needsAttentionCount, "Reviews or delivery issues"],
                        [<GroupsRounded key="i" />, "Candidates", overviewLoading ? null : overview.summary.totalCandidates ?? 0, `${overview.summary.submitted || 0} submitted`],
                        [<HourglassTopRounded key="i" />, "In progress", overviewLoading ? null : overview.summary.inProgress ?? 0, "Currently completing"],
                        [<AssignmentTurnedInRounded key="i" />, "Active assessments", overviewLoading ? null : overview.summary.activeAssessments ?? 0, `${overview.summary.assessments || 0} total`],
                    ].map(([icon, label, value, help]) => <Grid size={{ xs: 6, md: 3 }} key={label}>
                        <Paper variant="outlined" sx={{ p: 2.25, height: "100%", borderColor: label === "Needs attention" && Number(value) > 0 ? "warning.light" : undefined }}>
                            <Box color={label === "Needs attention" && Number(value) > 0 ? "warning.main" : "primary.main"} mb={1}>{icon}</Box>
                            {value == null ? <Skeleton width={48} height={34} /> : <Typography variant="h5" fontWeight={900}>{value}</Typography>}
                            <Typography fontWeight={800}>{label}</Typography>
                            <Typography variant="caption" color="text.secondary">{help}</Typography>
                        </Paper>
                    </Grid>)}
                </Grid>

                <Paper variant="outlined" sx={{ p: { xs: 2.25, md: 2.75 }, mb: 4, borderRadius: 3 }}>
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1} mb={2}>
                        <Box>
                            <Typography component="h2" variant="h6" fontWeight={850}>Needs attention</Typography>
                            <Typography variant="body2" color="text.secondary">Start here instead of scanning every assessment.</Typography>
                        </Box>
                        {attentionCandidates.length > 0 && <Button size="small" onClick={() => navigate("/hire/assessments#candidate-pipeline")}>View pipeline</Button>}
                    </Stack>
                    {overviewLoading ? <Stack spacing={1.25}>{[0, 1].map((item) => <Skeleton key={item} variant="rounded" height={62} />)}</Stack> : needsAttentionCount === 0 ? (
                        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ py: 1 }}><TaskAltRounded color="success" /><Box><Typography fontWeight={800}>Nothing urgent right now</Typography><Typography variant="body2" color="text.secondary">New submissions and delivery issues will appear here.</Typography></Box></Stack>
                    ) : <Stack divider={<Divider flexItem />}>
                        {Number(overview.summary.invitationFailed || 0) > 0 && <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1} py={1.25}><Box><Typography fontWeight={800}>{overview.summary.invitationFailed} invitation delivery issue{overview.summary.invitationFailed === 1 ? "" : "s"}</Typography><Typography variant="body2" color="text.secondary">Review the affected assessment and resend or update the candidate email.</Typography></Box><Button size="small" onClick={() => navigate("/hire/assessments#assessment-list")}>Open assessments</Button></Stack>}
                        {attentionCandidates.map((candidate) => <Stack key={candidate._id} direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1.25} py={1.25}>
                            <Box minWidth={0}><Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Typography fontWeight={850} sx={{ overflowWrap: "anywhere" }}>{candidate.candidateName}</Typography><Chip size="small" color={candidateStatusColor(candidate.status)} label={candidate.status === "evaluation_failed" ? "Evaluation needs retry" : "Ready for review"} /></Stack><Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{candidate.assessment?.title || "Assessment"} · {candidate.candidateEmail}</Typography></Box>{candidate.assessment?._id && <Button component={RouterLink} to={`/hire/assessments/${candidate.assessment._id}`} size="small" variant="outlined">Review evidence</Button>}</Stack>)}
                    </Stack>}
                </Paper>

                {(overview.summary.invitations || overview.summary.invitationFailed) > 0 && <Paper variant="outlined" sx={{ p: 2.5, mb: 4, borderRadius: 3 }}>
                    <Typography component="h2" variant="h6" fontWeight={850}>Candidate funnel</Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} gap={2} mt={1.5}>{[
                        ["Invited", overview.summary.invitations || 0],
                        ["Opened", overview.summary.invitationOpened || 0],
                        ["Started", overview.summary.totalCandidates || 0],
                        ["Submitted", overview.summary.submitted || 0],
                    ].map(([label, value]) => <Box key={label} flex={1}><Typography variant="h5" fontWeight={900}>{value}</Typography><Typography variant="body2" color="text.secondary">{label}</Typography></Box>)}</Stack>
                </Paper>}
            </>}

            {permissions.canViewCandidatePipeline && view !== "assessments" && <Paper id="candidate-pipeline" variant="outlined" sx={{ p: { xs: 2, md: 2.75 }, mb: 4, borderRadius: 3, scrollMarginTop: 100 }}>
                <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={2} mb={2.5}>
                    <Box><Typography component="h2" variant="h5" fontWeight={850}>Candidate pipeline</Typography><Typography variant="body2" color="text.secondary">Review recent candidates across assessments. AI scores are supporting signals, not decisions.</Typography></Box>
                    <Stack direction={{ xs: "column", sm: "row" }} gap={1.25} flexWrap="wrap">
                        <TextField size="small" label="Search name or email" value={candidateSearch} onChange={(event) => { setCandidateSearch(event.target.value); setCandidatePage(1); }} />
                        <TextField select size="small" label="Assessment" value={candidateAssessment} onChange={(event) => { setCandidateAssessment(event.target.value); setCandidatePage(1); }} sx={{ minWidth: 175 }}><MenuItem value="">All assessments</MenuItem>{overview.assessments.map((assessment) => <MenuItem key={assessment._id} value={assessment._id}>{assessment.title}</MenuItem>)}</TextField>
                        <TextField select size="small" label="Status" value={candidateStatus} onChange={(event) => { setCandidateStatus(event.target.value); setCandidatePage(1); }} sx={{ minWidth: 150 }}><MenuItem value="">All candidates</MenuItem><MenuItem value="started">In progress</MenuItem><MenuItem value="evaluating">Evaluating</MenuItem><MenuItem value="evaluation_failed">Needs retry</MenuItem><MenuItem value="submitted">Submitted</MenuItem></TextField>
                    </Stack>
                </Stack>
                {overviewLoading ? <Stack spacing={1.25}>{[0, 1, 2].map((item) => <Skeleton key={item} variant="rounded" height={72} />)}</Stack> : overview.candidates?.length ? <Stack divider={<Divider flexItem />}>
                    {overview.candidates.map((candidate) => <Stack key={candidate._id} direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={1.5} py={1.75}>
                        <Box minWidth={0} sx={{ flex: 1 }}><Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Typography fontWeight={850} sx={{ overflowWrap: "anywhere" }}>{candidate.candidateName}</Typography><Chip size="small" label={candidateStatusLabel(candidate.status)} color={candidateStatusColor(candidate.status)} /></Stack><Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{candidate.candidateEmail}</Typography></Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}><Typography fontWeight={750} sx={{ overflowWrap: "anywhere" }}>{candidate.assessment?.title || "Assessment"}</Typography><Typography variant="caption" color="text.secondary">{candidate.assessment?.jobRole || ""}</Typography></Box>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}><Box textAlign={{ md: "right" }}><Typography fontWeight={900}>{candidate.overallScore == null ? "—" : `${candidate.overallScore}/10`}</Typography><Typography variant="caption" color="text.secondary">{candidate.submittedAt ? `Submitted ${new Date(candidate.submittedAt).toLocaleDateString()}` : `Started ${new Date(candidate.startedAt).toLocaleDateString()}`}</Typography></Box>{candidate.assessment?._id && <Button component={RouterLink} to={`/hire/assessments/${candidate.assessment._id}`} size="small" variant="outlined">Review</Button>}</Stack>
                    </Stack>)}
                </Stack> : <Alert severity="info">{candidateSearch || candidateStatus || candidateAssessment ? "No candidates match these filters." : "Candidates will appear here once they start an assessment."}</Alert>}
                {(overview.totalPages || 1) > 1 && <Stack alignItems="center" mt={2}><Pagination page={candidatePage} count={overview.totalPages} onChange={(_, value) => setCandidatePage(value)} /></Stack>}
            </Paper>}

            {permissions.canViewAssessments && view !== "candidates" && <Box id="assessment-list" sx={{ scrollMarginTop: 100 }}>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1.5} mb={2}>
                    <Box><Typography component="h2" variant="h5" fontWeight={850}>Assessments</Typography><Typography variant="body2" color="text.secondary">See status and candidate activity at a glance. Open one only when you need to manage it.</Typography></Box>
                    {permissions.canManageAssessments && <Button startIcon={<AddRounded />} variant="outlined" onClick={() => navigate("/hire/assessments/new")}>Create assessment</Button>}
                </Stack>
                {assessmentsLoading ? <Stack spacing={1.5}>{[0, 1, 2].map((item) => <Skeleton key={item} variant="rounded" height={108} />)}</Stack> : items.length === 0 ? <Paper variant="outlined" sx={{ p: 4, textAlign: "center", borderStyle: "dashed", borderRadius: 3 }}><AssignmentTurnedInRounded color="primary" sx={{ fontSize: 42 }} /><Typography variant="h6" fontWeight={850} mt={1}>Create your first structured assessment</Typography><Typography color="text.secondary" mt={.5} mb={2}>The guided builder takes you from role context to a reviewed candidate experience in four focused steps.</Typography>{permissions.canManageAssessments && <Button variant="contained" startIcon={<AddRounded />} onClick={() => navigate("/hire/assessments/new")}>Create assessment</Button>}</Paper> : <Stack spacing={1.5}>{items.map((item) => {
                    const inProgress = Math.max((item.attemptCount || 0) - (item.submittedCount || 0), 0);
                    const completion = item.attemptCount ? Math.round((item.submittedCount || 0) / item.attemptCount * 100) : 0;
                    return <Card variant="outlined" key={item._id} sx={{ borderRadius: 3 }}><CardContent sx={{ p: { xs: 2.25, sm: 2.75 }, "&:last-child": { pb: { xs: 2.25, sm: 2.75 } } }}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={2.5}><Box sx={{ flex: 1, minWidth: 0 }}><Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Typography component="h3" variant="h6" fontWeight={850}>{item.title}</Typography><Chip size="small" label={item.status === "active" ? "published" : item.status} color={item.status === "active" ? "success" : ["draft", "scheduled"].includes(item.status) ? "warning" : "default"} /></Stack><Typography color="text.secondary">{item.jobRole}</Typography><Typography variant="body2" mt={1}>{item.status === "draft" ? "Private draft · not visible to candidates" : item.status === "scheduled" ? `Scheduled for ${new Date(item.opensAt).toLocaleString()}` : `${item.submittedCount || 0} submitted · ${inProgress} in progress · ${completion}% completion`}</Typography></Box><Stack direction="row" alignItems="center" gap={.75}>{permissions.canManageAssessments && item.status === "active" && <Button size="small" startIcon={<ContentCopyRounded />} onClick={() => copyLink(item.shareToken)}>Copy link</Button>}<Button component={RouterLink} to={`/hire/assessments/${item._id}`} variant="outlined">{permissions.canManageAssessments ? (item.status === "draft" ? "Review draft" : "Manage") : "View"}</Button></Stack></Stack></CardContent></Card>;
                })}</Stack>}
                {assessmentPages > 1 && <Stack alignItems="center" mt={3}><Pagination page={assessmentPage} count={assessmentPages} onChange={(_, value) => setAssessmentPage(value)} /></Stack>}
            </Box>}
        </Container>
    );
}
