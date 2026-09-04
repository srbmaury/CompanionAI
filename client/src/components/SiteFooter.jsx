import { Link as RouterLink } from "react-router-dom";
import { Box, Container, Link, Stack, Typography } from "@mui/material";

export default function SiteFooter() {
    return (
        <Box component="footer" sx={{ borderTop: "1px solid", borderColor: "divider", py: 4 }}>
            <Container maxWidth="lg">
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2}>
                    <Typography variant="body2" color="text.secondary">© {new Date().getFullYear()} CompanionAI</Typography>
                    <Stack direction="row" spacing={3}>
                        <Link component={RouterLink} to="/docs" color="text.secondary">Docs</Link>
                        <Link component={RouterLink} to="/privacy" color="text.secondary">Privacy</Link>
                        <Link component={RouterLink} to="/terms" color="text.secondary">Terms</Link>
                        <Link href="mailto:support@companionai.app" color="text.secondary">Contact</Link>
                    </Stack>
                </Stack>
            </Container>
        </Box>
    );
}
