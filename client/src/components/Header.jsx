import { useContext, useEffect, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { OrganizationContext } from "../context/OrganizationContext";
import { useThemeMode } from "../context/ThemeContext";
import { AddRounded, ArrowBackRounded, DarkMode, ExpandMoreRounded, LightMode, LogoutRounded, Menu as MenuIcon, NotificationsNoneRounded, RateReviewOutlined, SchoolOutlined, WorkOutlineRounded } from "@mui/icons-material";
import { AppBar, Avatar, Badge, Box, Button, Container, Divider, IconButton, ListItemText, Menu, MenuItem, Skeleton, Stack, Toolbar, Tooltip, Typography } from "@mui/material";
import ProductFeedbackDialog from "./ProductFeedbackDialog";
import useSafeBack from "../hooks/useSafeBack";
import { useNotifications } from "../context/NotificationContext";
import { getWorkspacePreference, setWorkspacePreference, WORKSPACE_EVENT } from "../utils/workspacePreference";
import { hiringHomeForRole, hiringPermissionsFor } from "../utils/hiringPermissions";

const Brand = ({ to }) => (
    <Typography component={RouterLink} to={to} variant="h6" sx={{ display: "flex", alignItems: "center", gap: 1.15, textDecoration: "none", color: "inherit", fontWeight: 850, letterSpacing: "-.025em" }}>
        <Box component="span" sx={{ width: 34, height: 34, borderRadius: 2.5, display: "grid", placeItems: "center", color: "white", background: "linear-gradient(135deg,#5b50d6,#8f85ff)", boxShadow: "0 8px 20px rgba(91,80,214,.28)", fontSize: 16 }}>C</Box>
        <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>CompanionAI</Box>
    </Typography>
);

export default function Header() {
    const { user, loading, logout } = useContext(AuthContext);
    const { mode, toggle } = useThemeMode();
    const navigate = useNavigate();
    const location = useLocation();
    const [anchor, setAnchor] = useState(null);
    const [workspaceAnchor, setWorkspaceAnchor] = useState(null);
    const [profileAnchor, setProfileAnchor] = useState(null);
    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const [notificationAnchor, setNotificationAnchor] = useState(null);
    const { notifications, clearNotifications } = useNotifications();
    const organizationContext = useContext(OrganizationContext);
    const currentOrganizationRole = organizationContext?.currentRole || null;
    const hasHiringOrganization = Boolean(organizationContext?.activeOrganizationId);
    const {
        canViewOverview: canViewHiringOverview,
        canViewCandidatePipeline,
        canViewAssessments,
        canManageAssessments,
        canManageOrganization,
    } = hiringPermissionsFor(currentOrganizationRole);
    const [workspace, setWorkspace] = useState("practice");
    useEffect(() => {
        setWorkspace(user?._id ? getWorkspacePreference(user._id) || "practice" : "practice");
    }, [user?._id]);
    useEffect(() => {
        const sync = (event) => {
            const detail = event.detail || {};
            if (detail.userId !== user?._id) return;
            setWorkspace(detail.workspace || getWorkspacePreference(user?._id) || "practice");
        };
        window.addEventListener(WORKSPACE_EVENT, sync);
        return () => window.removeEventListener(WORKSPACE_EVENT, sync);
    }, [user?._id]);
    useEffect(() => {
        const hiringRoute = location.pathname.startsWith("/assessments") || location.pathname.startsWith("/hiring");
        const practiceRoute = ["/dashboard", "/create-interview", "/interviews", "/resume", "/progress", "/experiences", "/saved-experiences"].some((path) => location.pathname.startsWith(path));
        if (!user?._id || (!hiringRoute && !practiceRoute)) return;
        const next = hiringRoute ? "hiring" : "practice";
        setWorkspacePreference(next, user._id);
        setWorkspace(next);
    }, [location.pathname, user?._id]);
    const switchWorkspace = (next) => { if (user?._id) setWorkspacePreference(next, user._id); setWorkspace(next); setWorkspaceAnchor(null); setProfileAnchor(null); navigate(next === "hiring" ? (hasHiringOrganization ? hiringHomeForRole(currentOrganizationRole) : "/hiring/team") : "/dashboard"); };
    const isActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);
    const isHiringHome = location.pathname === "/assessments" && !location.search && (!location.hash || (currentOrganizationRole === "reviewer" && location.hash === "#candidate-pipeline"));
    const isRootScreen = location.pathname === "/" || location.pathname === "/dashboard" || isHiringHome || (location.pathname === "/hiring/team" && !hasHiringOrganization);
    const isCandidateAssessment = location.pathname.startsWith("/assessment/");
    const navSx = (path) => ({ px: 1.5, color: isActive(path) ? "primary.main" : "text.secondary", bgcolor: isActive(path) ? "action.selected" : "transparent", "&:hover": { bgcolor: "action.hover", color: "text.primary" } });
    const handleLogout = async () => { await logout(); navigate("/login", { replace: true }); };
    const close = () => setAnchor(null);
    const goBack = useSafeBack(Boolean(user));
    const openNewAssessment = () => navigate("/assessments?create=1", { state: { openCreate: Date.now() } });
    const openHiringOverview = () => { navigate("/assessments"); window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" })); };
    const openHiringSection = (id) => {
        navigate(`/assessments#${id}`);
        window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };
    const workspaceHome = workspace === "hiring" ? (hasHiringOrganization ? hiringHomeForRole(currentOrganizationRole) : "/hiring/team") : "/dashboard";
    const workspaceLabel = workspace === "hiring" ? "Hiring" : "Practice";
    const WorkspaceIcon = workspace === "hiring" ? WorkOutlineRounded : SchoolOutlined;

    return (
        <AppBar position="sticky" color="transparent" elevation={0} sx={{ bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider", color: "text.primary", backdropFilter: "blur(18px)", zIndex: 1200 }}>
            <Container maxWidth="xl">
                <Toolbar disableGutters sx={{ minHeight: { xs: 64, md: 72 }, justifyContent: "space-between" }}>
                    <Stack direction="row" spacing={{ xs: .5, sm: 1 }} alignItems="center" minWidth={0}>
                        {!isRootScreen && !isCandidateAssessment && (
                            <Tooltip title="Go back">
                                <IconButton onClick={goBack} aria-label="Go back" edge="start"><ArrowBackRounded /></IconButton>
                            </Tooltip>
                        )}
                        <Brand to={user && !isCandidateAssessment ? workspaceHome : "/"} />
                        {user && !isCandidateAssessment && <>
                            <Button onClick={(event) => setWorkspaceAnchor(event.currentTarget)} aria-label="Switch workspace" color="inherit" size="small" startIcon={<WorkspaceIcon />} endIcon={<ExpandMoreRounded />} sx={{ ml: { xs: .25, sm: 1 }, px: { xs: 1, sm: 1.25 }, bgcolor: "action.hover", whiteSpace: "nowrap", "& .MuiButton-startIcon": { mr: { xs: 0, sm: .75 } }, "& .MuiButton-endIcon": { display: { xs: "none", sm: "inherit" } } }}><Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>{workspaceLabel}</Box></Button>
                            <Menu anchorEl={workspaceAnchor} open={Boolean(workspaceAnchor)} onClose={() => setWorkspaceAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "left" }} transformOrigin={{ vertical: "top", horizontal: "left" }} PaperProps={{ sx: { width: 310, maxWidth: "calc(100vw - 24px)" } }}>
                                <MenuItem selected={workspace === "practice"} onClick={() => switchWorkspace("practice")}><SchoolOutlined sx={{ mr: 1.5 }} /><ListItemText primary="Practice" secondary="Interviews, resumes, and personal progress" /></MenuItem>
                                <MenuItem selected={workspace === "hiring"} onClick={() => switchWorkspace("hiring")}><WorkOutlineRounded sx={{ mr: 1.5 }} /><ListItemText primary="Hiring" secondary="Assessments, candidates, and reports" /></MenuItem>
                            </Menu>
                        </>}
                    </Stack>
                    {isCandidateAssessment ? (
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Button component={RouterLink} to="/privacy" color="inherit">Privacy</Button>
                            <Tooltip title={mode === "dark" ? "Use light theme" : "Use dark theme"}>
                                <IconButton onClick={toggle} aria-label="Toggle theme">{mode === "dark" ? <LightMode /> : <DarkMode />}</IconButton>
                            </Tooltip>
                        </Stack>
                    ) : loading ? (
                        <Stack direction="row" spacing={1} alignItems="center" aria-label="Restoring your session">
                            <Skeleton variant="rounded" width={88} height={36} />
                            <Skeleton variant="circular" width={36} height={36} />
                        </Stack>
                    ) : user ? (
                        <>
                            <Stack direction="row" spacing={.5} alignItems="center" sx={{ display: { xs: "none", md: "flex" } }}>
                                {workspace === "practice" ? <>
                                    <Button component={RouterLink} to="/dashboard" sx={navSx("/dashboard")}>Overview</Button>
                                    <Button component={RouterLink} to="/resume-review" sx={navSx("/resume-review")}>Resume review</Button>
                                    <Button component={RouterLink} to="/progress" sx={navSx("/progress")}>Progress</Button>
                                    <Button component={RouterLink} to="/experiences" sx={navSx("/experiences")}>Company insights</Button>
                                </> : <>
                                    {!hasHiringOrganization && <Button component={RouterLink} to="/hiring/team" sx={navSx("/hiring/team")}>Set up Hiring</Button>}
                                    {hasHiringOrganization && canViewHiringOverview && <Button onClick={openHiringOverview} sx={{ px: 1.5, color: !location.hash ? "primary.main" : "text.secondary", bgcolor: !location.hash ? "action.selected" : "transparent", "&:hover": { bgcolor: "action.hover", color: "text.primary" } }}>Overview</Button>}
                                    {hasHiringOrganization && canViewCandidatePipeline && <Button onClick={() => openHiringSection("candidate-pipeline")} sx={{ px: 1.5, color: location.hash === "#candidate-pipeline" ? "primary.main" : "text.secondary", bgcolor: location.hash === "#candidate-pipeline" ? "action.selected" : "transparent" }}>Candidate pipeline</Button>}
                                    {hasHiringOrganization && canViewAssessments && <Button onClick={() => openHiringSection("assessment-list")} sx={{ px: 1.5, color: location.hash === "#assessment-list" ? "primary.main" : "text.secondary", bgcolor: location.hash === "#assessment-list" ? "action.selected" : "transparent" }}>Assessments</Button>}
                                    {hasHiringOrganization && canManageOrganization && <Button component={RouterLink} to="/hiring/team" sx={navSx("/hiring/team")}>Team & billing</Button>}
                                </>}
                                {user?.role === "admin" && <Button component={RouterLink} to="/admin/feedback" sx={navSx("/admin/feedback")}>Feedback inbox</Button>}
                                {(workspace !== "hiring" || canManageAssessments) && <Button component={workspace === "hiring" ? "button" : RouterLink} to={workspace === "hiring" ? undefined : "/create-interview"} onClick={workspace === "hiring" ? openNewAssessment : undefined} variant="contained" startIcon={<AddRounded />} sx={{ ml: 1, px: 2 }}>{workspace === "hiring" ? "New assessment" : "New practice"}</Button>}
                                <Tooltip title="Recent notifications"><IconButton onClick={(event) => setNotificationAnchor(event.currentTarget)} aria-label={`Recent notifications${notifications.length ? `, ${notifications.length} items` : ""}`}><Badge color="error" badgeContent={notifications.length} max={9}><NotificationsNoneRounded /></Badge></IconButton></Tooltip>
                                <Menu anchorEl={notificationAnchor} open={Boolean(notificationAnchor)} onClose={() => setNotificationAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }} PaperProps={{ sx: { width: 360, maxWidth: "calc(100vw - 24px)", maxHeight: 440 } }}>
                                    <Stack direction="row" alignItems="center" justifyContent="space-between" px={2} py={1}><Typography fontWeight={800}>Recent notifications</Typography>{notifications.length > 0 && <Button size="small" onClick={clearNotifications}>Clear</Button>}</Stack><Divider />
                                    {notifications.length === 0 ? <MenuItem disabled>No notifications yet</MenuItem> : notifications.map((item) => <MenuItem key={item.id} sx={{ whiteSpace: "normal", alignItems: "flex-start" }}><ListItemText primary={item.message} secondary={new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} primaryTypographyProps={{ variant: "body2", color: item.severity === "error" ? "error.main" : "text.primary" }} /></MenuItem>)}
                                </Menu>
                                <Tooltip title="Account"><IconButton onClick={(event) => setProfileAnchor(event.currentTarget)} aria-label="Open account menu"><Avatar sx={{ width: 36, height: 36, bgcolor: "primary.main", fontSize: 14, fontWeight: 800 }}>{user?.name?.charAt(0)?.toUpperCase() || "U"}</Avatar></IconButton></Tooltip>
                                <Menu anchorEl={profileAnchor} open={Boolean(profileAnchor)} onClose={() => setProfileAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
                                    <MenuItem component={RouterLink} to="/profile" onClick={() => setProfileAnchor(null)}>Profile & settings</MenuItem>
                                    {workspace === "practice" && <MenuItem component={RouterLink} to="/pricing" onClick={() => setProfileAnchor(null)}>Practice plans & billing</MenuItem>}
                                    {workspace === "hiring" && canManageOrganization && <MenuItem component={RouterLink} to="/hiring/team" onClick={() => setProfileAnchor(null)}>Team & Hiring billing</MenuItem>}
                                    {user?.role === "admin" && <MenuItem component={RouterLink} to="/admin/audit" onClick={() => setProfileAnchor(null)}>Audit activity</MenuItem>}
                                    <MenuItem onClick={() => { setProfileAnchor(null); setFeedbackOpen(true); }}><RateReviewOutlined fontSize="small" sx={{ mr: 1.5 }} />Share feedback</MenuItem>
                                    <MenuItem onClick={toggle}>{mode === "dark" ? <LightMode fontSize="small" sx={{ mr: 1.5 }} /> : <DarkMode fontSize="small" sx={{ mr: 1.5 }} />}{mode === "dark" ? "Light theme" : "Dark theme"}</MenuItem>
                                    <MenuItem onClick={handleLogout}><LogoutRounded fontSize="small" sx={{ mr: 1.5 }} />Log out</MenuItem>
                                </Menu>
                            </Stack>
                            <IconButton sx={{ display: { md: "none" } }} onClick={(event) => setAnchor(event.currentTarget)} aria-label="Open navigation"><MenuIcon /></IconButton>
                            <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
                                <MenuItem disabled sx={{ opacity: "1 !important" }}><ListItemText primary={`${workspaceLabel} workspace`} primaryTypographyProps={{ variant: "overline", fontWeight: 800, color: "primary.main" }} /></MenuItem>
                                {(workspace === "practice" || (hasHiringOrganization && canViewHiringOverview)) && <MenuItem component={RouterLink} to={workspaceHome} onClick={close}>Overview</MenuItem>}
                                {workspace === "hiring" && !hasHiringOrganization && <MenuItem component={RouterLink} to="/hiring/team" onClick={close}>Set up Hiring</MenuItem>}
                                {workspace === "hiring" ? (canManageAssessments && <MenuItem onClick={() => { close(); openNewAssessment(); }}>New assessment</MenuItem>) : <MenuItem component={RouterLink} to="/create-interview" onClick={close}>New practice</MenuItem>}
                                {workspace === "practice" && <MenuItem component={RouterLink} to="/resume-review" onClick={close}>Resume review</MenuItem>}
                                {workspace === "practice" && <MenuItem component={RouterLink} to="/progress" onClick={close}>Progress</MenuItem>}
                                {workspace === "practice" && <MenuItem component={RouterLink} to="/experiences" onClick={close}>Company insights</MenuItem>}
                                {workspace === "hiring" && hasHiringOrganization && canViewCandidatePipeline && <MenuItem onClick={() => { close(); openHiringSection("candidate-pipeline"); }}>Candidate pipeline</MenuItem>}
                                {workspace === "hiring" && hasHiringOrganization && canViewAssessments && <MenuItem onClick={() => { close(); openHiringSection("assessment-list"); }}>Assessments</MenuItem>}
                                {workspace === "hiring" && hasHiringOrganization && canManageOrganization && <MenuItem component={RouterLink} to="/hiring/team" onClick={close}>Team & Hiring billing</MenuItem>}
                                <MenuItem onClick={() => { close(); switchWorkspace(workspace === "practice" ? "hiring" : "practice"); }}>Switch to {workspace === "practice" ? "hiring" : "practice"} workspace</MenuItem>
                                <Divider />
                                <MenuItem component={RouterLink} to="/profile" onClick={close}>Profile & settings</MenuItem>
                                {workspace === "practice" && <MenuItem component={RouterLink} to="/pricing" onClick={close}>Practice plans & billing</MenuItem>}
                                {workspace === "hiring" && canManageOrganization && <MenuItem component={RouterLink} to="/hiring/team" onClick={close}>Team & Hiring billing</MenuItem>}
                                {user?.role === "admin" && <MenuItem component={RouterLink} to="/admin/feedback" onClick={close}>Feedback inbox</MenuItem>}
                                {user?.role === "admin" && <MenuItem component={RouterLink} to="/admin/audit" onClick={close}>Audit activity</MenuItem>}
                                {notifications.length > 0 && <Divider />}
                                {notifications.slice(0, 3).map((item) => <MenuItem key={item.id} disabled sx={{ whiteSpace: "normal", maxWidth: 320 }}><ListItemText primary={item.message} secondary="Recent notification" primaryTypographyProps={{ variant: "body2" }} /></MenuItem>)}
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
