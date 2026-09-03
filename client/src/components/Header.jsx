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
import { shouldShowGlobalBack } from "../utils/navigationHierarchy";

const Brand = ({ to }) => (
    <Typography component={RouterLink} to={to} variant="h6" sx={{ display: "flex", alignItems: "center", gap: 1.15, textDecoration: "none", color: "inherit", fontWeight: 850, letterSpacing: "-.025em" }}>
        <Box component="span" sx={{ width: 34, height: 34, borderRadius: 2.5, display: "grid", placeItems: "center", color: "white", background: "linear-gradient(135deg,#5b50d6,#8f85ff)", boxShadow: "0 8px 20px rgba(91,80,214,.28)", fontSize: 16 }}>C</Box>
        <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>CompanionAI</Box>
    </Typography>
);

const notificationTime = (value) => {
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return "Just now";
    const ageMs = Math.max(0, Date.now() - timestamp);
    const minutes = Math.floor(ageMs / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
};

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
    const { notifications, unreadCount, markNotificationRead, markAllRead, dismissNotification, clearNotifications } = useNotifications();
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
        setAnchor(null);
        setWorkspaceAnchor(null);
        setProfileAnchor(null);
        setNotificationAnchor(null);
        setFeedbackOpen(false);
    }, [user?._id, location.pathname, location.search, location.hash]);
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
    const hiringOverviewActive = location.pathname === "/assessments" && !location.search && !location.hash;
    const hiringCandidatePipelineActive = location.pathname === "/assessments" && !location.search && location.hash === "#candidate-pipeline";
    const hiringAssessmentsActive = location.pathname === "/assessments" && !location.search && location.hash === "#assessment-list";
    const isCandidateAssessment = location.pathname.startsWith("/assessment/");
    const showBackButton = shouldShowGlobalBack(location);
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
                        {showBackButton && !isCandidateAssessment && (
                            <Tooltip title="Go back">
                                <IconButton onClick={goBack} aria-label="Go back" edge="start"><ArrowBackRounded /></IconButton>
                            </Tooltip>
                        )}
                        <Brand to={user && !isCandidateAssessment ? workspaceHome : "/"} />
                        {user && !isCandidateAssessment && <>
                            <Button onClick={(event) => setWorkspaceAnchor(event.currentTarget)} aria-label="Switch workspace" color="inherit" size="small" startIcon={<WorkspaceIcon />} endIcon={<ExpandMoreRounded />} sx={{ ml: { xs: .25, sm: 1 }, px: { xs: 1, sm: 1.25 }, bgcolor: "action.hover", whiteSpace: "nowrap", "& .MuiButton-startIcon": { mr: { xs: 0, sm: .75 } }, "& .MuiButton-endIcon": { display: { xs: "none", sm: "inherit" } } }}><Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>{workspaceLabel}</Box></Button>
                            <Menu anchorEl={workspaceAnchor} open={Boolean(workspaceAnchor?.isConnected)} onClose={() => setWorkspaceAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "left" }} transformOrigin={{ vertical: "top", horizontal: "left" }} PaperProps={{ sx: { width: 310, maxWidth: "calc(100vw - 24px)" } }}>
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
                                    {hasHiringOrganization && canViewHiringOverview && <Button onClick={openHiringOverview} sx={{ px: 1.5, color: hiringOverviewActive ? "primary.main" : "text.secondary", bgcolor: hiringOverviewActive ? "action.selected" : "transparent", "&:hover": { bgcolor: "action.hover", color: "text.primary" } }}>Overview</Button>}
                                    {hasHiringOrganization && canViewCandidatePipeline && <Button onClick={() => openHiringSection("candidate-pipeline")} sx={{ px: 1.5, color: hiringCandidatePipelineActive ? "primary.main" : "text.secondary", bgcolor: hiringCandidatePipelineActive ? "action.selected" : "transparent" }}>Candidate pipeline</Button>}
                                    {hasHiringOrganization && canViewAssessments && <Button onClick={() => openHiringSection("assessment-list")} sx={{ px: 1.5, color: hiringAssessmentsActive ? "primary.main" : "text.secondary", bgcolor: hiringAssessmentsActive ? "action.selected" : "transparent" }}>Assessments</Button>}
                                    {hasHiringOrganization && canManageOrganization && <Button component={RouterLink} to="/hiring/team" sx={navSx("/hiring/team")}>Team & billing</Button>}
                                </>}
                                {user?.role === "admin" && <Button component={RouterLink} to="/admin/feedback" sx={navSx("/admin/feedback")}>Feedback inbox</Button>}
                                {(workspace !== "hiring" || canManageAssessments) && <Button component={workspace === "hiring" ? "button" : RouterLink} to={workspace === "hiring" ? undefined : "/create-interview"} onClick={workspace === "hiring" ? openNewAssessment : undefined} variant="contained" startIcon={<AddRounded />} sx={{ ml: 1, px: 2 }}>{workspace === "hiring" ? "New assessment" : "New practice"}</Button>}
                                <Tooltip title="Notifications"><IconButton onClick={(event) => setNotificationAnchor(event.currentTarget)} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}><Badge color="error" badgeContent={unreadCount} max={9}><NotificationsNoneRounded /></Badge></IconButton></Tooltip>
                                <Menu anchorEl={notificationAnchor} open={Boolean(notificationAnchor?.isConnected)} onClose={() => setNotificationAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }} PaperProps={{ sx: { width: 390, maxWidth: "calc(100vw - 24px)", maxHeight: 480 } }}>
                                    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} px={2} py={1.25}>
                                        <Box><Typography fontWeight={800}>Notifications</Typography><Typography variant="caption" color="text.secondary">{unreadCount ? `${unreadCount} unread` : "You’re all caught up"}</Typography></Box>
                                        <Stack direction="row" spacing={.25}>{unreadCount > 0 && <Button size="small" onClick={markAllRead}>Mark read</Button>}{notifications.length > 0 && <Button size="small" color="inherit" onClick={clearNotifications}>Clear</Button>}</Stack>
                                    </Stack><Divider />
                                    {notifications.length === 0 ? <Box px={2} py={3}><Typography variant="body2" color="text.secondary">No notifications yet. Saved changes, completed actions, and errors will appear here.</Typography></Box> : notifications.slice(0, 10).map((item) => <MenuItem key={item.id} selected={!item.read} onClick={() => markNotificationRead(item.id)} sx={{ whiteSpace: "normal", alignItems: "flex-start", gap: 1, py: 1.25 }}><Box aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: "50%", mt: .75, flexShrink: 0, bgcolor: item.severity === "error" ? "error.main" : item.severity === "warning" ? "warning.main" : item.severity === "success" ? "success.main" : "primary.main", opacity: item.read ? .3 : 1 }} /><ListItemText primary={item.message} secondary={notificationTime(item.at)} primaryTypographyProps={{ variant: "body2", fontWeight: item.read ? 500 : 750, color: item.severity === "error" ? "error.main" : "text.primary" }} secondaryTypographyProps={{ variant: "caption" }} /><IconButton size="small" aria-label="Dismiss notification" onClick={(event) => { event.stopPropagation(); dismissNotification(item.id); }}><Typography component="span" aria-hidden="true" fontSize={18} lineHeight={1}>×</Typography></IconButton></MenuItem>)}
                                </Menu>
                                <Tooltip title="Account"><IconButton onClick={(event) => setProfileAnchor(event.currentTarget)} aria-label="Open account menu"><Avatar sx={{ width: 36, height: 36, bgcolor: "primary.main", fontSize: 14, fontWeight: 800 }}>{user?.name?.charAt(0)?.toUpperCase() || "U"}</Avatar></IconButton></Tooltip>
                                <Menu anchorEl={profileAnchor} open={Boolean(profileAnchor?.isConnected)} onClose={() => setProfileAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
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
                            <Menu anchorEl={anchor} open={Boolean(anchor?.isConnected)} onClose={close} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
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
                                {notifications.slice(0, 3).map((item) => <MenuItem key={item.id} onClick={() => { markNotificationRead(item.id); close(); }} sx={{ whiteSpace: "normal", maxWidth: 320 }}><ListItemText primary={item.message} secondary={notificationTime(item.at)} primaryTypographyProps={{ variant: "body2", fontWeight: item.read ? 500 : 750 }} /></MenuItem>)}
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
