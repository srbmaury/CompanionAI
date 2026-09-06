import { useContext } from "react";
import { Link as RouterLink } from "react-router-dom";
import { ArrowForwardRounded, AssignmentTurnedInRounded, AutoAwesome, DescriptionOutlined, GraphicEq, GroupsRounded, Insights, PlayCircleOutline, WorkOutline } from "@mui/icons-material";
import { Box, Button, Chip, Container, Grid, Paper, Stack, Typography } from "@mui/material";
import { AuthContext } from "../context/AuthContext";
import SiteFooter from "../components/SiteFooter";
import { setWorkspacePreference } from "../utils/workspacePreference";

const features = [
    { icon: <WorkOutline />, title: "Built for your target role", body: "Turn any job description and resume into a realistic, multi-round interview plan." },
    { icon: <GraphicEq />, title: "Practice out loud", body: "Rehearse conversational answers with voice support or solve coding questions in the editor." },
    { icon: <Insights />, title: "Know what to improve", body: "Get specific feedback, scores, and practical suggestions after every answer." },
    { icon: <GroupsRounded />, title: "Run consistent candidate screens", body: "Create structured assessments, share one link, and manage every candidate from a single pipeline." },
];

export default function LandingPage() {
    const { user } = useContext(AuthContext);
    const primaryPath = user ? "/practice/dashboard" : "/practice/register";
    const hiringPath = user ? "/hire/assessments" : "/hire/register";
    const rememberWorkspace = (workspace) => {
        if (!user) setWorkspacePreference(workspace);
    };

    return (
        <Box component="section" sx={{ overflow: "hidden" }}>
            <Box sx={(theme) => ({
                background: theme.palette.mode === "dark"
                    ? "radial-gradient(circle at 75% 20%, rgba(124,92,255,.24), transparent 34%), #0b1020"
                    : "radial-gradient(circle at 75% 20%, rgba(99,91,255,.18), transparent 34%), linear-gradient(180deg,#f8f9ff,#fff)",
                py: { xs: 8, md: 13 },
            })}>
                <Container maxWidth="lg">
                    <Grid container spacing={7} alignItems="center">
                        <Grid size={{ xs: 12, md: 7 }}>
                            <Stack spacing={3} alignItems="flex-start">
                                <Chip icon={<AutoAwesome />} label="AI interviews for candidates and hiring teams" color="primary" variant="outlined" />
                                <Typography component="h1" sx={{ fontSize: { xs: "2.7rem", sm: "4rem", md: "5rem" }, lineHeight: .98, letterSpacing: "-.055em", fontWeight: 800, maxWidth: 760 }}>
                                    Prepare better. Hire with clearer evidence.
                                </Typography>
                                <Typography color="text.secondary" sx={{ fontSize: { xs: "1.05rem", md: "1.25rem" }, lineHeight: 1.65, maxWidth: 650 }}>
                                    Practice realistic interviews for your next role—or create structured candidate assessments, track every submission, and review consistent reports.
                                </Typography>
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} width={{ xs: "100%", sm: "auto" }}>
                                    <Button component={RouterLink} to={primaryPath} onClick={() => rememberWorkspace("practice")} variant="contained" size="large" sx={{ px: 3.5, py: 1.4 }}>
                                        {user ? "Open practice workspace" : "Practice interviews"}
                                    </Button>
                                    <Button component={RouterLink} to={hiringPath} onClick={() => rememberWorkspace("hiring")} variant="outlined" size="large" sx={{ px: 3.5, py: 1.4 }}>
                                        Assess candidates
                                    </Button>
                                </Stack>
                                <Typography variant="caption" color="text.secondary">No credit card required · Separate workspaces for practice and hiring</Typography>
                            </Stack>
                        </Grid>
                        <Grid size={{ xs: 12, md: 5 }}>
                            <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 5, border: "1px solid", borderColor: "divider", boxShadow: "0 24px 80px rgba(40,48,100,.16)", transform: { md: "rotate(1.5deg)" } }}>
                                <Typography variant="overline" color="primary.main" fontWeight={800}>One interview platform</Typography>
                                <Typography variant="h5" fontWeight={750} mt={.5}>Two focused workspaces</Typography>
                                <Typography color="text.secondary">Switch anytime without mixing candidate and practice data.</Typography>
                                <Stack spacing={1.25} mt={3}>
                                    {[["Practice", "Role-specific coaching and feedback"], ["Hiring", "Assessments, candidate pipeline and reports"]].map(([title, body], index) => (
                                        <Box key={title} sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1.75, borderRadius: 2.5, bgcolor: index === 0 ? "primary.main" : "action.hover", color: index === 0 ? "primary.contrastText" : "text.primary" }}>
                                            <Box sx={{ width: 36, height: 36, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: index === 0 ? "rgba(255,255,255,.2)" : "background.paper" }}>{index === 0 ? <PlayCircleOutline /> : <AssignmentTurnedInRounded />}</Box>
                                            <Box><Typography fontWeight={800}>{title} workspace</Typography><Typography variant="body2" sx={{ opacity: .8 }}>{body}</Typography></Box>
                                        </Box>
                                    ))}
                                </Stack>
                            </Paper>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            <Box sx={{ borderY: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
                <Container maxWidth="lg" sx={{ py: 3 }}>
                    <Grid container spacing={2}>
                        {[["For candidates", "practice, improve and track progress"], ["For recruiters", "create, share and manage assessments"], ["Evidence-led", "consistent reports with human review"]].map(([title, body]) => (
                            <Grid size={{ xs: 12, md: 4 }} key={title}><Stack direction="row" spacing={1.25} alignItems="baseline"><Typography fontWeight={850} color="primary.main" sx={{ whiteSpace: "nowrap" }}>{title}</Typography><Typography variant="body2" color="text.secondary">{body}</Typography></Stack></Grid>
                        ))}
                    </Grid>
                </Container>
            </Box>

            <Container maxWidth="lg" sx={{ py: { xs: 8, md: 11 } }}>
                <Typography variant="overline" color="primary.main" fontWeight={800}>Built around both sides of the interview</Typography>
                <Typography variant="h3" fontWeight={800} letterSpacing="-.035em" maxWidth={760} mt={1}>Practice confidently. Screen consistently.</Typography>
                <Grid container spacing={3} mt={3}>
                    {features.map((feature) => (
                        <Grid size={{ xs: 12, sm: 6, md: 3 }} key={feature.title}>
                            <Paper variant="outlined" sx={{ p: 3.5, height: "100%", borderRadius: 4 }}>
                                <Box sx={{ color: "primary.main", mb: 2 }}>{feature.icon}</Box>
                                <Typography variant="h6" fontWeight={750}>{feature.title}</Typography>
                                <Typography color="text.secondary" mt={1} lineHeight={1.7}>{feature.body}</Typography>
                            </Paper>
                        </Grid>
                    ))}
                </Grid>
            </Container>

            <Box sx={{ bgcolor: "action.hover", py: { xs: 8, md: 11 } }}>
                <Container maxWidth="lg">
                    <Stack alignItems="center" textAlign="center" spacing={1.5} mb={5}>
                        <Typography variant="overline" color="primary.main" fontWeight={850}>How it works</Typography>
                        <Typography variant="h3" fontWeight={850} letterSpacing="-.04em">From job description to useful evidence.</Typography>
                        <Typography color="text.secondary" maxWidth={660}>Candidates get focused practice. Hiring teams get repeatable interviews and one place to manage submissions.</Typography>
                    </Stack>
                    <Grid container spacing={3}>
                        {[
                            { n: "01", icon: <DescriptionOutlined />, title: "Define the role", body: "Use the real job description, success criteria, and optional resume context." },
                            { n: "02", icon: <AutoAwesome />, title: "Build the interview", body: "Review AI suggestions, add manual questions, and control every round." },
                            { n: "03", icon: <PlayCircleOutline />, title: "Practice or invite", body: "Start a private practice session or share a candidate assessment link." },
                            { n: "04", icon: <Insights />, title: "Act on evidence", body: "Improve weak answers or compare candidate reports with human judgment." },
                        ].map((step) => <Grid size={{ xs: 12, sm: 6, md: 3 }} key={step.n}><Paper variant="outlined" sx={{ p: 3.5, height: "100%", borderRadius: 4 }}><Stack direction="row" justifyContent="space-between" color="primary.main"><Box>{step.icon}</Box><Typography fontWeight={850} color="text.disabled">{step.n}</Typography></Stack><Typography variant="h6" fontWeight={800} mt={3}>{step.title}</Typography><Typography color="text.secondary" mt={1} lineHeight={1.7}>{step.body}</Typography></Paper></Grid>)}
                    </Grid>
                </Container>
            </Box>

            <Container maxWidth="lg" sx={{ py: { xs: 8, md: 11 } }}>
                <Paper sx={{ p: { xs: 4, md: 7 }, borderRadius: 5, color: "white", background: "linear-gradient(135deg,#4438b8,#7165ed 58%,#8f85ff)" }}>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={3}>
                        <Box><Typography variant="h3" fontWeight={850} letterSpacing="-.04em">Make interviews useful for everyone involved.</Typography><Typography sx={{ color: "rgba(255,255,255,.78)", mt: 1.5, fontSize: "1.05rem" }}>Practice for your next role or run your first structured candidate screen.</Typography></Box>
                        <Stack direction={{ xs: "column", sm: "row" }} gap={1}><Button component={RouterLink} to={primaryPath} onClick={() => rememberWorkspace("practice")} variant="contained" size="large" endIcon={<ArrowForwardRounded />} sx={{ bgcolor: "white", color: "#4438b8", px: 3, flexShrink: 0, "&:hover": { bgcolor: "#f4f2ff" } }}>Practice</Button><Button component={RouterLink} to={hiringPath} onClick={() => rememberWorkspace("hiring")} variant="outlined" size="large" sx={{ borderColor: "rgba(255,255,255,.65)", color: "white", px: 3, flexShrink: 0 }}>Hire</Button></Stack>
                    </Stack>
                </Paper>
            </Container>
            <SiteFooter />
        </Box>
    );
}
