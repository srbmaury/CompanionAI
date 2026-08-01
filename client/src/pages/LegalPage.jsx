import { Box, Container, Link, Paper, Stack, Typography } from "@mui/material";
import SiteFooter from "../components/SiteFooter";

const privacySections = [
    ["What we collect", "Account details, resumes and extracted text, target-role information, interview answers, audio submitted for transcription, generated feedback, and security/operational logs."],
    ["How it is used", "We use this information to provide personalized interview practice, resume feedback, authentication, abuse prevention, support, and service reliability."],
    ["Service providers", "Depending on enabled features, content may be processed by configured AI providers such as OpenAI or Google Gemini, Cloudinary for resume storage, Tavily for web research, Judge0 for code execution, and monitoring or email providers."],
    ["Retention and control", "Data remains until you delete individual resumes or delete your account. Account deletion removes account records, interviews, answers, feedback, resumes, and active sessions. Provider backups and operational logs may take additional time to expire."],
    ["Your choices", "Do not upload information you do not want processed. You can delete resumes from your profile and permanently delete your account and associated personal data from the profile danger zone."],
    ["Security", "We use access controls, encrypted transport, short-lived sessions, rate limits, audit logging, and file validation. No online service can guarantee absolute security."],
];

const termsSections = [
    ["Service", "CompanionAI provides practice questions and AI-generated feedback for educational purposes. It does not guarantee interviews, offers, scores, or employment outcomes."],
    ["Acceptable use", "Do not misuse the service, access another person’s data, evade limits, upload malicious files, or use code execution to attack systems."],
    ["Your content", "You retain ownership of content you submit and grant the service the limited permission needed to process it and provide the requested features."],
    ["AI limitations", "AI output can be inaccurate, incomplete, or biased. Review important recommendations independently and do not treat feedback as a hiring decision."],
    ["Availability and accounts", "Features and limits may change. Accounts that create security, legal, or operational risk may be suspended. You may delete your account at any time."],
];

export default function LegalPage({ type }) {
    const privacy = type === "privacy";
    const sections = privacy ? privacySections : termsSections;
    return (
        <>
            <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 } }}>
                <Paper variant="outlined" sx={{ p: { xs: 3, md: 6 }, borderRadius: 4 }}>
                    <Typography variant="overline" color="primary.main" fontWeight={800}>CompanionAI</Typography>
                    <Typography component="h1" variant="h3" fontWeight={800} mt={1}>{privacy ? "Privacy notice" : "Terms of use"}</Typography>
                    <Typography color="text.secondary" mt={1}>Effective August 1, 2026</Typography>
                    <Stack spacing={4} mt={5}>
                        {sections.map(([title, body]) => <Box key={title}><Typography component="h2" variant="h6" fontWeight={750}>{title}</Typography><Typography color="text.secondary" mt={1} lineHeight={1.75}>{body}</Typography></Box>)}
                        <Box><Typography component="h2" variant="h6" fontWeight={750}>Questions</Typography><Typography color="text.secondary" mt={1}>Contact <Link href="mailto:support@companionai.app">support@companionai.app</Link>.</Typography></Box>
                    </Stack>
                </Paper>
            </Container>
            <SiteFooter />
        </>
    );
}
