import { useContext } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
    ArrowForwardRounded,
    AutoAwesome,
    CheckCircleRounded,
    DescriptionOutlined,
    GroupsRounded,
    InsightsRounded,
    PsychologyRounded,
    SchoolOutlined,
    ShieldOutlined,
    WorkOutlineRounded,
} from "@mui/icons-material";
import { Box, Button, Chip, Container, Grid, Paper, Stack, Typography } from "@mui/material";
import { AuthContext } from "../context/AuthContext";
import SiteFooter from "../components/SiteFooter";
import { productHomePath, productLoginPath, productRegisterPath } from "../utils/productRoutes";
import { setWorkspacePreference } from "../utils/workspacePreference";

const COPY = {
    practice: {
        eyebrow: "Evalcue AI Practice",
        icon: <SchoolOutlined />,
        headline: "Train for the interview you actually have.",
        subheadline: "Turn your target role, job description, and resume into adaptive technical interviews that keep probing until there is enough evidence to show what you know and what to improve.",
        primary: "Start practicing",
        secondary: "Sign in",
        crossLabel: "Hiring teams",
        crossPath: "/hire",
        crossText: "Use Evalcue AI Hire",
        proof: "Built for candidates · Private practice data · Evidence-backed feedback",
        features: [
            { icon: <PsychologyRounded />, title: "Adaptive interview engine", body: "Questions change with your answers, competency coverage, confidence, and resume claims instead of following a static script." },
            { icon: <DescriptionOutlined />, title: "Role and resume context", body: "Practice against the exact job description and resume you plan to use, not generic interview prompts." },
            { icon: <InsightsRounded />, title: "Actionable feedback", body: "See evidence, scoring, weak competencies, and concrete next steps after each round." },
            { icon: <AutoAwesome />, title: "Technical formats", body: "Rehearse conversational, coding, and system-design rounds from one focused preparation workspace." },
        ],
        steps: [
            ["01", "Set the target", "Add the role, company context, job description, and resume."],
            ["02", "Run adaptive rounds", "Answer realistic questions while the engine targets uncertainty and missing evidence."],
            ["03", "Review the evidence", "Use scores, feedback, and competency gaps to decide what to practice next."],
        ],
    },
    hiring: {
        eyebrow: "Evalcue AI Hire",
        icon: <WorkOutlineRounded />,
        headline: "Screen technical candidates without burning senior-engineer hours.",
        subheadline: "Create structured, adaptive assessments from the role you are hiring for, invite candidates with one link, and review evidence-rich reports before deciding where human interviewer time matters most.",
        primary: "Create hiring workspace",
        secondary: "Recruiter sign in",
        crossLabel: "Candidates",
        crossPath: "/practice",
        crossText: "Use Evalcue AI Practice",
        proof: "Organization-owned hiring data · Human review · Calibration-ready scoring",
        features: [
            { icon: <GroupsRounded />, title: "Structured candidate pipeline", body: "Create assessments, invite candidates, track submissions, and keep hiring evidence inside the organization workspace." },
            { icon: <PsychologyRounded />, title: "Adaptive technical interviews", body: "Probe competency gaps, resume claims, and difficulty dynamically instead of giving every candidate the same shallow sequence." },
            { icon: <InsightsRounded />, title: "Evidence-first reports", body: "Review answers, scorecards, decision traces, and competency evidence rather than relying on a single opaque AI score." },
            { icon: <ShieldOutlined />, title: "Human-controlled decisions", body: "Use AI to collect and organize signal while keeping hiring judgment, calibration, and override authority with your team." },
        ],
        steps: [
            ["01", "Define the role", "Create the scorecard from the job description, success criteria, and interview plan."],
            ["02", "Invite and assess", "Send one candidate link and let adaptive rounds collect targeted technical evidence."],
            ["03", "Review and calibrate", "Compare reports with human judgment and use disagreement data to improve scoring quality."],
        ],
    },
};

export default function ProductLandingPage({ surface = "practice" }) {
    const { user } = useContext(AuthContext);
    const config = COPY[surface] || COPY.practice;
    const workspace = surface === "hiring" ? "hiring" : "practice";
    const primaryPath = user ? productHomePath(workspace) : productRegisterPath(workspace);
    const secondaryPath = user ? productHomePath(workspace) : productLoginPath(workspace);

    const rememberSurface = () => setWorkspacePreference(workspace, user?._id);

    return (
        <Box component="section" sx={{ overflow: "hidden" }}>
            <Box sx={(theme) => ({
                py: { xs: 8, md: 13 },
                background: surface === "hiring"
                    ? theme.palette.mode === "dark"
                        ? "radial-gradient(circle at 78% 18%, rgba(31,156,142,.24), transparent 34%), #081412"
                        : "radial-gradient(circle at 78% 18%, rgba(31,156,142,.16), transparent 34%), linear-gradient(180deg,#f4fbf9,#fff)"
                    : theme.palette.mode === "dark"
                        ? "radial-gradient(circle at 78% 18%, rgba(124,92,255,.24), transparent 34%), #0b1020"
                        : "radial-gradient(circle at 78% 18%, rgba(99,91,255,.18), transparent 34%), linear-gradient(180deg,#f8f9ff,#fff)",
            })}>
                <Container maxWidth="lg">
                    <Grid container spacing={7} alignItems="center">
                        <Grid size={{ xs: 12, md: 7 }}>
                            <Stack spacing={3} alignItems="flex-start">
                                <Chip icon={config.icon} label={config.eyebrow} color="primary" variant="outlined" />
                                <Typography component="h1" sx={{ fontSize: { xs: "2.8rem", sm: "4rem", md: "5rem" }, lineHeight: .98, letterSpacing: "-.055em", fontWeight: 850, maxWidth: 780 }}>
                                    {config.headline}
                                </Typography>
                                <Typography color="text.secondary" sx={{ fontSize: { xs: "1.05rem", md: "1.25rem" }, lineHeight: 1.65, maxWidth: 720 }}>
                                    {config.subheadline}
                                </Typography>
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} width={{ xs: "100%", sm: "auto" }}>
                                    <Button component={RouterLink} to={primaryPath} onClick={rememberSurface} variant="contained" size="large" endIcon={<ArrowForwardRounded />} sx={{ px: 3.5, py: 1.4 }}>
                                        {user ? `Open ${surface === "hiring" ? "Hire" : "Practice"}` : config.primary}
                                    </Button>
                                    <Button component={RouterLink} to={secondaryPath} onClick={rememberSurface} variant="outlined" size="large" sx={{ px: 3.5, py: 1.4 }}>
                                        {user ? "Continue" : config.secondary}
                                    </Button>
                                </Stack>
                                <Typography variant="caption" color="text.secondary">{config.proof}</Typography>
                            </Stack>
                        </Grid>
                        <Grid size={{ xs: 12, md: 5 }}>
                            <Paper elevation={0} sx={{ p: { xs: 3, sm: 4 }, borderRadius: 5, border: "1px solid", borderColor: "divider", boxShadow: "0 24px 80px rgba(40,48,100,.14)" }}>
                                <Typography variant="overline" color="primary.main" fontWeight={850}>{surface === "hiring" ? "Hiring signal" : "Practice signal"}</Typography>
                                <Typography variant="h5" fontWeight={800} mt={.5}>{surface === "hiring" ? "Collect enough evidence before spending interviewer time." : "Practice until the weak signal becomes obvious."}</Typography>
                                <Stack spacing={1.4} mt={3}>
                                    {(surface === "hiring"
                                        ? ["Competency coverage", "Adaptive difficulty", "Resume-claim validation", "Human calibration"]
                                        : ["Target-role coverage", "Adaptive follow-ups", "Resume-claim practice", "Progress over time"]
                                    ).map((item) => (
                                        <Stack key={item} direction="row" spacing={1.2} alignItems="center">
                                            <CheckCircleRounded color="primary" fontSize="small" />
                                            <Typography fontWeight={700}>{item}</Typography>
                                        </Stack>
                                    ))}
                                </Stack>
                            </Paper>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            <Container maxWidth="lg" sx={{ py: { xs: 8, md: 11 } }}>
                <Typography variant="overline" color="primary.main" fontWeight={850}>Purpose-built workflow</Typography>
                <Typography variant="h3" fontWeight={850} letterSpacing="-.04em" maxWidth={800} mt={1}>
                    {surface === "hiring" ? "A hiring product, not a candidate-practice screen with recruiter controls added." : "A candidate product, not a recruiter dashboard with practice mode bolted on."}
                </Typography>
                <Grid container spacing={3} mt={3}>
                    {config.features.map((feature) => (
                        <Grid size={{ xs: 12, sm: 6, md: 3 }} key={feature.title}>
                            <Paper variant="outlined" sx={{ p: 3.5, height: "100%", borderRadius: 4 }}>
                                <Box sx={{ color: "primary.main", mb: 2 }}>{feature.icon}</Box>
                                <Typography variant="h6" fontWeight={800}>{feature.title}</Typography>
                                <Typography color="text.secondary" mt={1} lineHeight={1.7}>{feature.body}</Typography>
                            </Paper>
                        </Grid>
                    ))}
                </Grid>
            </Container>

            <Box sx={{ bgcolor: "action.hover", py: { xs: 8, md: 10 } }}>
                <Container maxWidth="lg">
                    <Stack spacing={1.5} textAlign="center" alignItems="center" mb={5}>
                        <Typography variant="overline" color="primary.main" fontWeight={850}>How it works</Typography>
                        <Typography variant="h3" fontWeight={850} letterSpacing="-.04em">{surface === "hiring" ? "From role definition to reviewable evidence." : "From target role to a focused improvement loop."}</Typography>
                    </Stack>
                    <Grid container spacing={3}>
                        {config.steps.map(([n, title, body]) => (
                            <Grid size={{ xs: 12, md: 4 }} key={n}>
                                <Paper variant="outlined" sx={{ p: 4, height: "100%", borderRadius: 4 }}>
                                    <Typography color="primary.main" fontWeight={900}>{n}</Typography>
                                    <Typography variant="h5" fontWeight={800} mt={2}>{title}</Typography>
                                    <Typography color="text.secondary" mt={1} lineHeight={1.7}>{body}</Typography>
                                </Paper>
                            </Grid>
                        ))}
                    </Grid>
                </Container>
            </Box>

            {surface === "hiring" && (
                <Container maxWidth="lg" sx={{ py: { xs: 7, md: 9 } }}>
                    <Paper variant="outlined" sx={{ p: { xs: 3, md: 5 }, borderRadius: 4 }}>
                        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={3} alignItems={{ md: "center" }}>
                            <Box maxWidth={760}>
                                <Typography variant="overline" color="primary.main" fontWeight={850}>Responsible hiring design</Typography>
                                <Typography variant="h4" fontWeight={850} mt={.5}>AI organizes evidence. People make employment decisions.</Typography>
                                <Typography color="text.secondary" mt={1}>Evalcue AI Hire is designed for structured evidence collection, human review, calibration, and explicit recruiter or hiring-manager judgment—not fully automated hiring decisions.</Typography>
                            </Box>
                            <ShieldOutlined color="primary" sx={{ fontSize: 56 }} />
                        </Stack>
                    </Paper>
                </Container>
            )}

            <Container maxWidth="lg" sx={{ pb: { xs: 8, md: 11 }, pt: surface === "hiring" ? 0 : { xs: 8, md: 10 } }}>
                <Paper sx={{ p: { xs: 4, md: 6 }, borderRadius: 5, color: "white", background: surface === "hiring" ? "linear-gradient(135deg,#12685f,#1f9c8e 58%,#4db7aa)" : "linear-gradient(135deg,#4438b8,#7165ed 58%,#8f85ff)" }}>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={3}>
                        <Box>
                            <Typography variant="overline" sx={{ color: "rgba(255,255,255,.72)" }}>{config.crossLabel}</Typography>
                            <Typography variant="h4" fontWeight={850}>{config.crossText}</Typography>
                            <Typography sx={{ color: "rgba(255,255,255,.78)", mt: 1 }}>The products share an interview platform underneath, but your workflow and data stay separated by purpose.</Typography>
                        </Box>
                        <Button component={RouterLink} to={config.crossPath} variant="contained" endIcon={<ArrowForwardRounded />} sx={{ bgcolor: "white", color: surface === "hiring" ? "#12685f" : "#4438b8", px: 3, flexShrink: 0, "&:hover": { bgcolor: "#f7f7fb" } }}>
                            {config.crossText}
                        </Button>
                    </Stack>
                </Paper>
            </Container>
            <SiteFooter />
        </Box>
    );
}
