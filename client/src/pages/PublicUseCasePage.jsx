import { ArrowForwardRounded, CheckCircleOutline } from "@mui/icons-material";
import { Box, Button, Chip, Container, Grid, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink, Navigate, useLocation } from "react-router-dom";
import Seo from "../components/Seo";
import SiteFooter from "../components/SiteFooter";
import { setWorkspacePreference } from "../utils/workspacePreference";

const pages = {
    "/interview-practice": {
        eyebrow: "For software engineers",
        title: "AI technical interview practice built around your target role",
        description: "Practice conversational, coding, and system-design interviews with role-specific context, then review concrete feedback and recurring improvement areas.",
        workspace: "practice",
        cta: "Start interview practice",
        registerPath: "/register?workspace=practice",
        highlights: [
            ["Role-specific sessions", "Use a job description and your own background to practice questions that match the kind of role you are pursuing."],
            ["Multiple interview formats", "Rehearse spoken technical answers, work through coding rounds, and explain system-design decisions instead of practicing only trivia."],
            ["Evidence-based improvement", "Review answer-level feedback, score trends, and recurring weaknesses so practice becomes deliberate rather than repetitive."],
            ["Personal workspace", "Your resumes, practice history, goals, reminders, and Practice subscription belong to your individual account."],
        ],
        docs: [
            ["How to use AI interview practice effectively", "/docs/candidates/ai-interview-practice"],
            ["What strong system-design interviews evaluate", "/docs/technical-hiring/system-design-interviews"],
        ],
    },
    "/technical-hiring": {
        eyebrow: "For engineering teams",
        title: "Structured technical assessments with clearer candidate evidence",
        description: "Create job-relevant coding, conversational, and system-design assessments, manage candidates as a team, and review consistent evidence before committing more engineer-hours.",
        workspace: "hiring",
        cta: "Create a hiring organization",
        registerPath: "/register?workspace=hiring",
        highlights: [
            ["Organization-owned hiring", "Assessments, candidate attempts, reports, roles, and Hiring billing belong to the organization rather than an individual recruiter."],
            ["Technical depth", "Combine coding, technical discussion, and system design in one structured assessment instead of reducing engineering evaluation to multiple-choice screening."],
            ["Shared scorecards", "Capture evidence against consistent competencies and let human reviewers add their own scores, notes, and decisions."],
            ["Enterprise access controls", "Use organization roles today and configure OpenID Connect work SSO for Enterprise Hiring teams that need centralized identity."],
        ],
        docs: [
            ["Designing structured technical assessments", "/docs/technical-hiring/structured-technical-assessments"],
            ["Technical interview scorecards", "/docs/technical-hiring/interview-scorecards"],
            ["Responsible integrity signals and human review", "/docs/security/human-review-and-integrity-signals"],
            ["Configure OIDC work SSO", "/docs/hiring/oidc-sso"],
        ],
    },
};

export default function PublicUseCasePage() {
    const { pathname } = useLocation();
    const page = pages[pathname];
    if (!page) return <Navigate to="/" replace />;

    const title = `${page.title} | Evalcue AI`;
    const rememberWorkspace = () => setWorkspacePreference(page.workspace);

    return (
        <Box>
            <Seo
                title={title}
                description={page.description}
                canonicalPath={pathname}
                structuredData={{
                    "@context": "https://schema.org",
                    "@type": "WebPage",
                    name: page.title,
                    description: page.description,
                    isPartOf: { "@type": "WebSite", name: "Evalcue AI", url: window.location.origin },
                }}
            />
            <Box sx={(theme) => ({
                py: { xs: 7, md: 11 },
                background: theme.palette.mode === "dark"
                    ? "radial-gradient(circle at 75% 15%, rgba(124,92,255,.2), transparent 35%)"
                    : "linear-gradient(180deg, rgba(99,91,255,.08), transparent)",
            })}>
                <Container maxWidth="lg">
                    <Stack maxWidth={850} spacing={2.5} alignItems="flex-start">
                        <Chip label={page.eyebrow} color="primary" variant="outlined" />
                        <Typography component="h1" sx={{ fontSize: { xs: "2.7rem", md: "4.5rem" }, lineHeight: 1, letterSpacing: "-.05em", fontWeight: 900 }}>{page.title}</Typography>
                        <Typography variant="h6" color="text.secondary" sx={{ lineHeight: 1.65, maxWidth: 760 }}>{page.description}</Typography>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                            <Button component={RouterLink} to={page.registerPath} onClick={rememberWorkspace} variant="contained" size="large" endIcon={<ArrowForwardRounded />}>{page.cta}</Button>
                            <Button component={RouterLink} to="/docs" variant="outlined" size="large">Read the documentation</Button>
                        </Stack>
                    </Stack>
                </Container>
            </Box>

            <Container maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
                <Grid container spacing={2.5}>
                    {page.highlights.map(([heading, body]) => (
                        <Grid size={{ xs: 12, md: 6 }} key={heading}>
                            <Paper variant="outlined" sx={{ p: 3, borderRadius: 4, height: "100%" }}>
                                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                                    <CheckCircleOutline color="primary" sx={{ mt: .4 }} />
                                    <Box>
                                        <Typography component="h2" variant="h5" fontWeight={850}>{heading}</Typography>
                                        <Typography color="text.secondary" mt={1} sx={{ lineHeight: 1.7 }}>{body}</Typography>
                                    </Box>
                                </Stack>
                            </Paper>
                        </Grid>
                    ))}
                </Grid>

                <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, mt: 5 }}>
                    <Typography component="h2" variant="h4" fontWeight={850}>Related guides</Typography>
                    <Stack mt={2} spacing={1.5}>
                        {page.docs.map(([label, path]) => (
                            <Typography key={path} component={RouterLink} to={path} color="primary.main" sx={{ textDecoration: "none", fontWeight: 750 }}>{label} →</Typography>
                        ))}
                    </Stack>
                </Paper>
            </Container>
            <SiteFooter />
        </Box>
    );
}
