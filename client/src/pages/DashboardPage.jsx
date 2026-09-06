import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api/axios";
import { AuthContext } from "../context/AuthContext";
import { trackEvent } from "../utils/analytics";
import { canonicalProductPath } from "../utils/productRoutes";

import { Add, ArrowForward, CheckCircleOutline, InsightsOutlined, PlayCircleOutline, RadioButtonUnchecked, TrackChanges } from "@mui/icons-material";
import { Alert, Box, Button, Card, CardActionArea, CardContent, Chip, Container, Grid, LinearProgress, Pagination, Skeleton, Stack, Typography, ToggleButton, ToggleButtonGroup } from "@mui/material";

const DashboardPage = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [interviews, setInterviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalInterviews, setTotalInterviews] = useState(0);
    const [statusFilter, setStatusFilter] = useState("all");
    const [error, setError] = useState("");
    const [progress, setProgress] = useState({ averageScore: 0, improvement: 0, completed: 0 });
    const [recommendations, setRecommendations] = useState([]);
    const [entitlements, setEntitlements] = useState(null);
    const [resumeCount, setResumeCount] = useState(0);

    useEffect(() => {
        if (!user?._id) return;
        trackEvent("dashboard_viewed");
        api.get("/interviews/analytics/progress").then(({ data }) => setProgress(data || {})).catch(() => {});
        api.get("/recommendations").then(({ data }) => setRecommendations(data?.actions || [])).catch(() => {});
        api.get("/billing/practice/entitlements").then(({ data }) => setEntitlements(data || null)).catch(() => {});
        api.get("/resumes", { params: { page: 1, limit: 1 } }).then(({ data }) => setResumeCount(Array.isArray(data) ? data.length : Number(data?.total) || 0)).catch(() => {});
    }, [user]);

    useEffect(() => {
        const fetchInterviews = async () => {
            setLoading(true);
            setError("");
            try {
                const { data } = await api.get(`/interviews`, { params: { page, limit } });
                if (Array.isArray(data)) {
                    setInterviews(data);
                    setTotalPages(1);
                    setTotalInterviews(data.length);
                } else {
                    setInterviews(Array.isArray(data?.items) ? data.items : []);
                    setTotalPages(Number(data?.totalPages) || 1);
                    setTotalInterviews(Number(data?.total) || 0);
                }
            } catch (err) {
                console.error(err);
                setInterviews([]);
                setTotalPages(1);
                setTotalInterviews(0);
                setError("We couldn't load your practice history. Please refresh and try again.");
            } finally {
                setLoading(false);
            }
        };
        if (user?._id) fetchInterviews();
    }, [user, page, limit]);

    const completedCount = interviews.filter((item) => item.isCompleted).length;
    const firstName = user?.name?.trim()?.split(/\s+/)[0] || "there";

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={2} mb={4}>
                <Box>
                    <Typography variant="overline" color="primary.main" fontWeight={800}>Evalcue AI Practice</Typography>
                    <Typography component="h1" variant="h3" sx={{ fontSize: { xs: "2.45rem", sm: "3rem" } }} fontWeight={800} letterSpacing="-.035em">Ready for the next one, {firstName}?</Typography>
                    <Typography color="text.secondary" mt={1}>Keep your momentum going with focused, role-specific practice.</Typography>
                </Box>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Button variant="outlined" size="large" startIcon={<InsightsOutlined />} onClick={() => navigate("/practice/progress")} sx={{ flexShrink: 0 }}>View progress</Button>
                    <Button variant="contained" size="large" startIcon={<Add />} onClick={() => navigate("/practice/new")} sx={{ flexShrink: 0 }}>New interview</Button>
                </Stack>
            </Stack>

            {!user?.targetRole && Number(progress.completed || 0) > 0 && <Alert severity="info" sx={{ mb: 3 }} action={<Button color="inherit" size="small" onClick={() => navigate("/practice/profile")}>Set my goal</Button>}>Personalize your plan with a target role and weekly practice goal.</Alert>}
            {user?.targetRole && <Card variant="outlined" sx={{ mb: 3 }}><CardContent><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}><Box><Typography variant="overline" color="primary.main" fontWeight={800}>Your practice plan</Typography><Typography fontWeight={750}>{user.targetRole}</Typography></Box><Chip label={`${user.weeklyPracticeTarget || 3} sessions / week`} color="primary" variant="outlined" /></Stack></CardContent></Card>}

            {!loading && Number(progress.completed || 0) === 0 && <Card variant="outlined" sx={{ mb: 4, borderColor: "primary.light" }}><CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}><Typography variant="overline" color="primary.main" fontWeight={850}>Getting started</Typography><Typography variant="h5" fontWeight={800}>Complete your first practice loop</Typography><Typography color="text.secondary" mt={0.5} mb={2.5}>A focused setup gets you to useful feedback quickly.</Typography><Stack spacing={1.25}>{[
                { done: Boolean(user?.targetRole), label: "Set your target role", action: "Set goal", href: "/practice/profile" },
                { done: resumeCount > 0, label: "Add the résumé you plan to use", action: "Add résumé", href: "/practice/resumes" },
                { done: totalInterviews > 0, label: "Create a tailored interview", action: "Create interview", href: "/practice/new" },
                { done: Number(progress.completed || 0) > 0, label: "Complete one round and review feedback", action: "Continue", href: interviews[0]?._id ? `/practice/interviews/${interviews[0]._id}` : "/practice/new" },
            ].map((step) => <Stack key={step.label} direction="row" alignItems="center" spacing={1.5} sx={{ p: 1.25, borderRadius: 2, bgcolor: step.done ? "action.hover" : "transparent" }}>{step.done ? <CheckCircleOutline color="success" /> : <RadioButtonUnchecked color="disabled" />}<Typography flex={1} fontWeight={step.done ? 500 : 700} color={step.done ? "text.secondary" : "text.primary"}>{step.label}</Typography>{!step.done && <Button size="small" onClick={() => navigate(step.href)}>{step.action}</Button>}</Stack>)}</Stack></CardContent></Card>}

            {recommendations.length > 0 && <Box mb={4}><Typography component="h2" variant="h5" fontWeight={750} mb={2}>Recommended next steps</Typography><Grid container spacing={2}>{recommendations.map((item, index) => <Grid size={{ xs: 12, md: index === 0 ? 6 : 3 }} key={item.id}><Card variant="outlined" sx={{ height: "100%", borderColor: index === 0 ? "primary.light" : undefined }}><CardActionArea onClick={() => navigate(canonicalProductPath(item.href || "/practice/dashboard"))} sx={{ height: "100%" }}><CardContent><Typography component="h3" variant={index === 0 ? "h6" : "body1"} fontWeight={750}>{item.title}</Typography><Typography variant="body2" color="text.secondary" mt={1}>{item.reason || "Based on your saved goal and latest practice."}</Typography><ArrowForward color="primary" sx={{ mt: 2 }} /></CardContent></CardActionArea></Card></Grid>)}</Grid></Box>}

            {entitlements && <Alert severity={entitlements.plan === "pro" ? "success" : "info"} sx={{ mb: 3 }} action={<Button color="inherit" size="small" onClick={() => navigate("/practice/pricing")}>{entitlements.plan === "free" ? "View Pro" : "Manage"}</Button>}>
                <strong>{entitlements.plan === "pro" ? "Practice Pro" : "Practice Free"}:</strong> {entitlements.used.interviews} of {entitlements.limits.interviews} practice interviews and {entitlements.used.resumeReviews} of {entitlements.limits.resumeReviews} resume reviews used in {entitlements.period}. Hiring capacity is billed separately to each organization in Evalcue AI Hire.
            </Alert>}

            {!loading && interviews.length > 0 && <Grid container spacing={2.5} mb={4}>{[
                { label: "Total sessions", value: totalInterviews, icon: <TrackChanges /> },
                { label: "Average score", value: progress.averageScore ? `${progress.averageScore}/10` : "—", icon: <PlayCircleOutline /> },
                { label: "Completed sessions", value: progress.completed || completedCount, icon: <CheckCircleOutline /> },
            ].map((stat) => <Grid size={{ xs: 12, sm: 4 }} key={stat.label}><Card variant="outlined"><CardContent sx={{ display: "flex", alignItems: "center", gap: 2.25 }}><Box sx={{ width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: 3, bgcolor: "action.hover", color: "primary.main" }}>{stat.icon}</Box><Box><Typography variant="h5" fontWeight={800}>{stat.value}</Typography><Typography variant="body2" color="text.secondary">{stat.label}</Typography></Box></CardContent></Card></Grid>)}</Grid>}

            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={2} mb={2}>
                <Typography component="h2" variant="h5" fontWeight={750}>Your interviews</Typography>
                {!loading && interviews.length > 0 && <ToggleButtonGroup value={statusFilter} exclusive onChange={(_, v) => setStatusFilter(v || "all")} size="small" color="primary" aria-label="Filter interviews on this page"><ToggleButton value="all">All</ToggleButton><ToggleButton value="in_progress">In progress</ToggleButton><ToggleButton value="completed">Completed</ToggleButton></ToggleButtonGroup>}
            </Stack>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {loading ? <Stack spacing={2}>{Array.from({ length: 4 }).map((_, i) => <Card key={i} variant="outlined"><CardContent><Skeleton variant="text" width="40%" height={28} /><Skeleton variant="text" width="25%" height={20} sx={{ mt: 0.5 }} /><Skeleton variant="text" width="20%" height={16} sx={{ mt: 0.5 }} /><Skeleton variant="rounded" width={80} height={24} sx={{ mt: 1 }} /></CardContent></Card>)}</Stack> : interviews.length === 0 ? <Card variant="outlined" sx={{ borderStyle: "dashed" }}><Stack spacing={2} alignItems="center" textAlign="center" sx={{ py: 8, px: 2 }}><Box sx={{ width: 56, height: 56, display: "grid", placeItems: "center", borderRadius: "50%", bgcolor: "action.hover", color: "primary.main" }}><TrackChanges /></Box><Typography variant="h6" fontWeight={750}>Your practice journey starts here</Typography><Typography color="text.secondary" maxWidth={460}>Add a target role and your resume. Evalcue AI Practice will create a tailored interview plan for you.</Typography><Button variant="contained" startIcon={<Add />} onClick={() => navigate("/practice/new")}>Create your first interview</Button></Stack></Card> : <Stack spacing={2}>{(() => {
                const filtered = interviews.filter((it) => statusFilter === "all" ? true : statusFilter === "completed" ? Boolean(it.isCompleted) : !it.isCompleted);
                if (filtered.length === 0) return <Typography color="text.secondary" sx={{ py: 2 }}>No {statusFilter === "completed" ? "completed" : "in-progress"} interviews yet.</Typography>;
                return filtered.map((interview) => <Card key={interview._id} variant="outlined" sx={{ transition: "transform .18s ease, box-shadow .18s ease", "&:hover": { transform: "translateY(-2px)", boxShadow: 3 } }}><CardActionArea onClick={() => navigate(`/practice/interviews/${interview._id}`)}><CardContent><Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}><Box><Typography variant="h6" fontWeight={750}>{interview.jobRole}</Typography><Typography color="text.secondary">{interview.company} · {new Date(interview.createdAt).toLocaleDateString()}</Typography></Box><Stack direction="row" alignItems="center" gap={.5}><Typography variant="body2" fontWeight={700} color="primary.main">{interview.isCompleted ? "Review" : "Continue"}</Typography><ArrowForward color="primary" /></Stack></Stack><Stack direction="row" spacing={1} mt={2.5} mb={1.5} alignItems="center"><Chip size="small" label={interview.isCompleted ? "Completed" : "In Progress"} color={interview.isCompleted ? "success" : "warning"} />{Number.isFinite(Number(interview.roundsCompleted)) && Number.isFinite(Number(interview.roundsTotal)) && <Typography variant="caption" color="text.secondary">Rounds: {interview.roundsCompleted}/{interview.roundsTotal}</Typography>}</Stack>{Number(interview.roundsTotal) > 0 && <LinearProgress variant="determinate" value={Math.min(100, (Number(interview.roundsCompleted) / Number(interview.roundsTotal)) * 100)} sx={{ height: 6, borderRadius: 99 }} />}</CardContent></CardActionArea></Card>);
            })()}</Stack>}

            {totalPages > 1 && <Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}><Pagination color="primary" page={page} count={totalPages} onChange={(_, p) => setPage(p)} /></Box>}
        </Container>
    );
};

export default DashboardPage;
