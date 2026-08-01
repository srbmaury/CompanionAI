import { useContext, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { useThemeMode } from "../context/ThemeContext";
import { AddRounded, ArrowBackRounded, DarkMode, LightMode, LogoutRounded, Menu as MenuIcon, RateReviewOutlined } from "@mui/icons-material";
import { AppBar, Avatar, Box, Button, Container, IconButton, Menu, MenuItem, Stack, Toolbar, Tooltip, Typography } from "@mui/material";
import ProductFeedbackDialog from "./ProductFeedbackDialog";
import useSafeBack from "../hooks/useSafeBack";

const Brand = ({ to }) => (
    <Typography component={RouterLink} to={to} variant="h6" sx={{ display: "flex", alignItems: "center", gap: 1.15, textDecoration: "none", color: "inherit", fontWeight: 850, letterSpacing: "-.025em" }}>
        <Box component="span" sx={{ width: 34, height: 34, borderRadius: 2.5, display: "grid", placeItems: "center", color: "white", background: "linear-gradient(135deg,#5b50d6,#8f85ff)", boxShadow: "0 8px 20px rgba(91,80,214,.28)", fontSize: 16 }}>C</Box>
        <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>CompanionAI</Box>
    </Typography>
);

export default function Header() {
    const { user, logout } = useContext(AuthContext);
    const { mode, toggle } = useThemeMode();
    const navigate = useNavigate();
    const location = useLocation();
    const [anchor, setAnchor] = useState(null);
    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const isActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);
    const isRootScreen = location.pathname === "/" || location.pathname === "/dashboard";
    const navSx = (path) => ({ px: 1.5, color: isActive(path) ? "primary.main" : "text.secondary", bgcolor: isActive(path) ? "action.selected" : "transparent", "&:hover": { bgcolor: "action.hover", color: "text.primary" } });
    const handleLogout = async () => { await logout(); navigate("/login", { replace: true }); };
    const close = () => setAnchor(null);
    const goBack = useSafeBack(Boolean(user));

    return (
        <AppBar position="sticky" color="transparent" elevation={0} sx={{ bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider", color: "text.primary", backdropFilter: "blur(18px)", zIndex: 1200 }}>
            <Container maxWidth="xl">
                <Toolbar disableGutters sx={{ minHeight: { xs: 64, md: 72 }, justifyContent: "space-between" }}>
                    <Stack direction="row" spacing={{ xs: .5, sm: 1 }} alignItems="center" minWidth={0}>
                        {!isRootScreen && (
                            <Tooltip title="Go back">
                                <IconButton onClick={goBack} aria-label="Go back" edge="start"><ArrowBackRounded /></IconButton>
                            </Tooltip>
                        )}
                        <Brand to={user ? "/dashboard" : "/"} />
                    </Stack>
                    {user ? (
                        <>
                            <Stack direction="row" spacing={.5} alignItems="center" sx={{ display: { xs: "none", md: "flex" } }}>
                                <Button component={RouterLink} to="/dashboard" sx={navSx("/dashboard")}>Dashboard</Button>
                                <Button component={RouterLink} to="/experiences" sx={navSx("/experiences")}>Experiences</Button>
                                <Button component={RouterLink} to="/resume-review" sx={navSx("/resume-review")}>Resume review</Button>
                                <Button component={RouterLink} to="/pricing" sx={navSx("/pricing")}>Plans</Button>
                                {user?.role === "admin" && <Button component={RouterLink} to="/admin/feedback" sx={navSx("/admin/feedback")}>Feedback inbox</Button>}
                                <Button component={RouterLink} to="/create-interview" variant="contained" startIcon={<AddRounded />} sx={{ ml: 1.5, px: 2 }}>New practice</Button>
                                <Tooltip title={mode === "dark" ? "Use light theme" : "Use dark theme"}><IconButton onClick={toggle} aria-label="Toggle theme">{mode === "dark" ? <LightMode /> : <DarkMode />}</IconButton></Tooltip>
                                <Tooltip title="Profile"><IconButton component={RouterLink} to="/profile" aria-label="Open profile"><Avatar sx={{ width: 34, height: 34, bgcolor: "primary.main", fontSize: 14, fontWeight: 800 }}>{user?.name?.charAt(0)?.toUpperCase() || "U"}</Avatar></IconButton></Tooltip>
                                <Tooltip title="Share feedback"><IconButton onClick={() => setFeedbackOpen(true)} aria-label="Share product feedback"><RateReviewOutlined /></IconButton></Tooltip>
                                <Button color="inherit" startIcon={<LogoutRounded />} onClick={handleLogout}>Log out</Button>
                            </Stack>
                            <IconButton sx={{ display: { md: "none" } }} onClick={(event) => setAnchor(event.currentTarget)} aria-label="Open navigation"><MenuIcon /></IconButton>
                            <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
                                <MenuItem component={RouterLink} to="/dashboard" onClick={close}>Dashboard</MenuItem>
                                <MenuItem component={RouterLink} to="/create-interview" onClick={close}>New practice</MenuItem>
                                <MenuItem component={RouterLink} to="/experiences" onClick={close}>Experiences</MenuItem>
                                <MenuItem component={RouterLink} to="/resume-review" onClick={close}>Resume review</MenuItem>
                                <MenuItem component={RouterLink} to="/pricing" onClick={close}>Plans & billing</MenuItem>
                                {user?.role === "admin" && <MenuItem component={RouterLink} to="/admin/feedback" onClick={close}>Feedback inbox</MenuItem>}
                                <MenuItem component={RouterLink} to="/profile" onClick={close}>Profile</MenuItem>
                                <MenuItem onClick={() => { close(); setFeedbackOpen(true); }}>Share feedback</MenuItem>
                                <MenuItem onClick={() => { toggle(); close(); }}>{mode === "dark" ? "Light theme" : "Dark theme"}</MenuItem>
                                <MenuItem onClick={() => { close(); handleLogout(); }}>Log out</MenuItem>
                            </Menu>
                        </>
                    ) : (
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Tooltip title={mode === "dark" ? "Use light theme" : "Use dark theme"}>
                                <IconButton onClick={toggle} aria-label="Toggle theme">{mode === "dark" ? <LightMode /> : <DarkMode />}</IconButton>
                            </Tooltip>
                            <Button component={RouterLink} to="/login" color="inherit">Sign in</Button>
                            <Button component={RouterLink} to="/register" variant="contained">Get started</Button>
                        </Stack>
                    )}
                </Toolbar>
            </Container>
            {user && <ProductFeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />}
        </AppBar>
    );
}
