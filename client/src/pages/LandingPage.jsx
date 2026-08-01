import { useContext } from "react";
import { Link as RouterLink } from "react-router-dom";
import { ArrowForwardRounded, AutoAwesome, DescriptionOutlined, GraphicEq, Insights, PlayCircleOutline, WorkOutline } from "@mui/icons-material";
import { Box, Button, Chip, Container, Grid, Paper, Stack, Typography } from "@mui/material";
import { AuthContext } from "../context/AuthContext";
import SiteFooter from "../components/SiteFooter";

const features = [
    { icon: <WorkOutline />, title: "Built for your target role", body: "Turn any job description and resume into a realistic, multi-round interview plan." },
    { icon: <GraphicEq />, title: "Practice out loud", body: "Rehearse conversational answers with voice support or solve coding questions in the editor." },
    { icon: <Insights />, title: "Know what to improve", body: "Get specific feedback, scores, and practical suggestions after every answer." },
];

export default function LandingPage() {
    const { user } = useContext(AuthContext);
    const primaryPath = user ? "/dashboard" : "/register";

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
                                <Chip icon={<AutoAwesome />} label="Your AI interview coach" color="primary" variant="outlined" />
                                <Typography component="h1" sx={{ fontSize: { xs: "2.7rem", sm: "4rem", md: "5rem" }, lineHeight: .98, letterSpacing: "-.055em", fontWeight: 800, maxWidth: 760 }}>
                                    Walk into your next interview prepared.
                                </Typography>
                                <Typography color="text.secondary" sx={{ fontSize: { xs: "1.05rem", md: "1.25rem" }, lineHeight: 1.65, maxWidth: 650 }}>
                                    CompanionAI builds a practice interview around the role you want, listens to your answers, and turns every session into a clear improvement plan.
                                </Typography>
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} width={{ xs: "100%", sm: "auto" }}>
                                    <Button component={RouterLink} to={primaryPath} variant="contained" size="large" sx={{ px: 3.5, py: 1.4 }}>
                                        {user ? "Continue practicing" : "Start practicing free"}
                                    </Button>
                                    <Button component={RouterLink} to="/login" variant="outlined" size="large" sx={{ px: 3.5, py: 1.4 }}>
                                        I already have an account
                                    </Button>
                                </Stack>
                                <Typography variant="caption" color="text.secondary">No credit card required · Set up your first interview in minutes</Typography>
                            </Stack>
                        </Grid>
                        <Grid size={{ xs: 12, md: 5 }}>
                            <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 5, border: "1px solid", borderColor: "divider", boxShadow: "0 24px 80px rgba(40,48,100,.16)", transform: { md: "rotate(1.5deg)" } }}>
                                <Typography variant="overline" color="primary.main" fontWeight={800}>Today’s practice</Typography>
                                <Typography variant="h5" fontWeight={750} mt={.5}>Senior Product Engineer</Typography>
                                <Typography color="text.secondary">Acme · 4 interview rounds</Typography>
                                <Stack spacing={1.25} mt={3}>
                                    {["Behavioral & leadership", "System design", "Technical deep dive", "Coding exercise"].map((round, index) => (
                                        <Box key={round} sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1.5, borderRadius: 2.5, bgcolor: index === 0 ? "primary.main" : "action.hover", color: index === 0 ? "primary.contrastText" : "text.primary" }}>
                                            <Box sx={{ width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: index === 0 ? "rgba(255,255,255,.2)" : "background.paper", fontWeight: 700 }}>{index + 1}</Box>
                                            <Typography fontWeight={650}>{round}</Typography>
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
                        {[["Tailored", "to your resume and target role"], ["Multi-format", "voice, behavioral, system design and code"], ["Actionable", "feedback after every answer"]].map(([title, body]) => (
                            <Grid size={{ xs: 12, md: 4 }} key={title}><Stack direction="row" spacing={1.25} alignItems="baseline"><Typography fontWeight={850} color="primary.main" sx={{ whiteSpace: "nowrap" }}>{title}</Typography><Typography variant="body2" color="text.secondary">{body}</Typography></Stack></Grid>
                        ))}
                    </Grid>
                </Container>
            </Box>

            <Container maxWidth="lg" sx={{ py: { xs: 8, md: 11 } }}>
                <Typography variant="overline" color="primary.main" fontWeight={800}>Practice with purpose</Typography>
                <Typography variant="h3" fontWeight={800} letterSpacing="-.035em" maxWidth={650} mt={1}>A feedback loop built for getting better.</Typography>
                <Grid container spacing={3} mt={3}>
                    {features.map((feature) => (
                        <Grid size={{ xs: 12, md: 4 }} key={feature.title}>
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
                        <Typography variant="h3" fontWeight={850} letterSpacing="-.04em">From job post to practice plan.</Typography>
                        <Typography color="text.secondary" maxWidth={600}>A focused workflow designed to get you practicing quickly—not configuring another tool.</Typography>
                    </Stack>
                    <Grid container spacing={3}>
                        {[
                            { n: "01", icon: <DescriptionOutlined />, title: "Add the role", body: "Paste the job description and choose the resume you plan to submit." },
                            { n: "02", icon: <AutoAwesome />, title: "Shape your interview", body: "Review the suggested rounds, formats, and question counts before you begin." },
                            { n: "03", icon: <PlayCircleOutline />, title: "Practice and improve", body: "Answer naturally, review focused feedback, and repeat where it matters." },
                        ].map((step) => <Grid size={{ xs: 12, md: 4 }} key={step.n}><Paper variant="outlined" sx={{ p: 3.5, height: "100%", borderRadius: 4 }}><Stack direction="row" justifyContent="space-between" color="primary.main"><Box>{step.icon}</Box><Typography fontWeight={850} color="text.disabled">{step.n}</Typography></Stack><Typography variant="h6" fontWeight={800} mt={3}>{step.title}</Typography><Typography color="text.secondary" mt={1} lineHeight={1.7}>{step.body}</Typography></Paper></Grid>)}
                    </Grid>
                </Container>
            </Box>

            <Container maxWidth="lg" sx={{ py: { xs: 8, md: 11 } }}>
                <Paper sx={{ p: { xs: 4, md: 7 }, borderRadius: 5, color: "white", background: "linear-gradient(135deg,#4438b8,#7165ed 58%,#8f85ff)" }}>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={3}>
                        <Box><Typography variant="h3" fontWeight={850} letterSpacing="-.04em">Your next interview can feel familiar.</Typography><Typography sx={{ color: "rgba(255,255,255,.78)", mt: 1.5, fontSize: "1.05rem" }}>Build your first tailored practice session in minutes.</Typography></Box>
                        <Button component={RouterLink} to={primaryPath} variant="contained" size="large" endIcon={<ArrowForwardRounded />} sx={{ bgcolor: "white", color: "#4438b8", px: 3, flexShrink: 0, "&:hover": { bgcolor: "#f4f2ff" } }}>{user ? "Continue practicing" : "Start for free"}</Button>
                    </Stack>
                </Paper>
            </Container>
            <SiteFooter />
        </Box>
    );
}
