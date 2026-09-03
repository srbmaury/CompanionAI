import { AutoAwesome, CheckCircleRounded } from "@mui/icons-material";
import { Box, Chip, Container, Paper, Stack, Typography } from "@mui/material";

export default function AuthShell({ eyebrow, title, subtitle, children }) {
    return (
        <Box sx={(theme) => ({
            minHeight: { xs: "calc(100dvh - 65px)", md: "calc(100dvh - 73px)" },
            display: "grid",
            alignItems: "center",
            py: { xs: 3, md: 2 },
            background: theme.palette.mode === "dark"
                ? "radial-gradient(circle at 12% 15%, rgba(124,92,255,.16), transparent 28%), #0b1020"
                : "radial-gradient(circle at 12% 15%, rgba(91,80,214,.10), transparent 30%), #f7f8fc",
        })}>
            <Container maxWidth="lg">
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,.88fr) minmax(440px,1fr)" }, gap: { xs: 4, md: 7 }, alignItems: "center" }}>
                    <Stack spacing={2.25} sx={{ display: { xs: "none", md: "flex" }, maxWidth: 480 }}>
                        <Chip icon={<AutoAwesome />} label="Practice and Hiring" color="primary" variant="outlined" sx={{ alignSelf: "flex-start" }} />
                        <Typography variant="h3" fontWeight={850} letterSpacing="-.045em" lineHeight={1.05}>One account. Two focused workflows.</Typography>
                        <Typography color="text.secondary" fontSize="1.05rem" lineHeight={1.6}>Prepare for interviews without mixing your personal work with structured candidate assessments and hiring reports.</Typography>
                        <Stack spacing={1.15} pt={0.5}>
                            {["Practice interviews and resume feedback", "Candidate assessments and reports", "Switch workspaces anytime"].map((item) => (
                                <Stack direction="row" spacing={1.25} alignItems="center" key={item}><CheckCircleRounded color="secondary" fontSize="small" /><Typography fontWeight={650}>{item}</Typography></Stack>
                            ))}
                        </Stack>
                    </Stack>
                    <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden", boxShadow: "0 20px 60px rgba(24,29,60,.10)" }}>
                        <Box sx={{ p: { xs: 3, sm: 4 } }}>
                            <Typography variant="overline" color="primary.main" fontWeight={850}>{eyebrow}</Typography>
                            <Typography component="h1" variant="h4" fontWeight={800} letterSpacing="-.025em" mt={.5}>{title}</Typography>
                            <Typography color="text.secondary" mt={0.75}>{subtitle}</Typography>
                            <Box mt={{ xs: 3, md: 2.25 }}>{children}</Box>
                        </Box>
                    </Paper>
                </Box>
            </Container>
        </Box>
    );
}
