import { useContext, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import {
    AddRounded,
    ArrowBackRounded,
    DarkMode,
    ExpandMoreRounded,
    LightMode,
    LogoutRounded,
    Menu as MenuIcon,
    NotificationsNoneRounded,
    PersonOutlineRounded,
    RateReviewOutlined,
    SchoolOutlined,
    SettingsOutlined,
    SwapHorizRounded,
    WorkOutlineRounded,
} from "@mui/icons-material";
import {
    AppBar,
    Avatar,
    Badge,
    Box,
    Button,
    Container,
    Divider,
    IconButton,
    ListItemText,
    Menu,
    MenuItem,
    Stack,
    Toolbar,
    Tooltip,
    Typography,
} from "@mui/material";
import { AuthContext } from "../context/AuthContext";
import { OrganizationContext } from "../context/OrganizationContext";
import { useThemeMode } from "../context/ThemeContext";
import { useNotifications } from "../context/NotificationContext";
import ProductFeedbackDialog from "./ProductFeedbackDialog";
import { hiringHomeForRole, hiringPermissionsFor } from "../utils/hiringPermissions";
import { productHomePath, productLoginPath, productRegisterPath } from "../utils/productRoutes";
import { setWorkspacePreference } from "../utils/workspacePreference";

const CONFIG = {
    practice: {
        workspace: "practice",
        label: "Practice",
        icon: SchoolOutlined,
        publicHome: "/practice",
        appHome: "/practice/dashboard",
        crossPath: "/hire",
        crossLabel: "Open Evalcue AI Hire",
    },
    hiring: {
        workspace: "hiring",
        label: "Hire",
        icon: WorkOutlineRounded,
        publicHome: "/hire",
        appHome: "/hire/assessments",
        crossPath: "/practice",
        crossLabel: "Open Evalcue AI Practice",
    },
};

const PRACTICE_RESUME_ITEMS = [
    { label: "Review resume", path: "/practice/resume-review" },
    { label: "Match to job", path: "/practice/resume-match" },
    { label: "My resumes", path: "/practice/resumes" },
    { label: "Review history", path: "/practice/resume-reviews" },
];

const navButtonSx = (active) => ({
    px: 1.35,
    color: active ? "primary.main" : "text.secondary",
    bgcolor: active ? "action.selected" : "transparent",
    "&:hover": { bgcolor: "action.hover", color: "text.primary" },
});

export const isProductNavItemActive = (location, item) => {
    if (item.paths?.includes(location.pathname)) return true;
    if (item.matchPrefix && location.pathname.startsWith(item.matchPrefix)) return true;
    if (location.pathname !== item.path) return false;
    return item.hash ? location.hash === item.hash : !location.hash;
};

const ProductBrand = ({ config, surface, to, interactive = true }) => {
    const ProductIcon = config.icon;
    const content = (
        <>
            <Box sx={{
                width: 34,
                height: 34,
                borderRadius: 2.5,
                display: "grid",
                placeItems: "center",
                color: "white",
                background: surface === "hiring" ? "linear-gradient(135deg,#12685f,#36aa9d)" : "linear-gradient(135deg,#5b50d6,#8f85ff)",
                boxShadow: surface === "hiring" ? "0 8px 20px rgba(18,104,95,.24)" : "0 8px 20px rgba(91,80,214,.28)",
            }}><ProductIcon fontSize="small" /></Box>
            <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={900} letterSpacing="-.025em" lineHeight={1.05} sx={{ display: { xs: "none", sm: "block" } }}>Evalcue AI</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={800} lineHeight={1} sx={{ display: { xs: "none", sm: "block" } }}>{config.label}</Typography>
            </Box>
        </>
    );

    return interactive ? (
        <Stack direction="row" spacing={1.15} alignItems="center" minWidth={0} component={RouterLink} to={to} sx={{ textDecoration: "none", color: "inherit", flexShrink: 0 }}>
            {content}
        </Stack>
    ) : (
        <Stack direction="row" spacing={1.15} alignItems="center" minWidth={0} sx={{ flexShrink: 0 }}>
            {content}
        </Stack>
    );
};

export default function ProductHeader({ surface = "practice" }) {
    const config = CONFIG[surface] || CONFIG.practice;
    const { user, loading, logout } = useContext(AuthContext);
    const organizationContext = useContext(OrganizationContext);
    const organizations = organizationContext?.organizations || [];
    const activeOrganization = organizationContext?.activeOrganization || null;
    const selectOrganization = organizationContext?.selectOrganization || (() => {});
    const currentRole = organizationContext?.currentRole || null;
    const permissions = hiringPermissionsFor(currentRole);
    const { mode, toggle } = useThemeMode();
    const { notifications, unreadCount, markNotificationRead, markAllRead } = useNotifications();
    const location = useLocation();
    const navigate = useNavigate();
    const [mobileAnchor, setMobileAnchor] = useState(null);
    const [profileAnchor, setProfileAnchor] = useState(null);
    const [organizationAnchor, setOrganizationAnchor] = useState(null);
    const [workspaceAnchor, setWorkspaceAnchor] = useState(null);
    const [resumeAnchor, setResumeAnchor] = useState(null);
    const [notificationAnchor, setNotificationAnchor] = useState(null);
    const [feedbackOpen, setFeedbackOpen] = useState(false);

    const isAuthScreen = /^\/(practice|hire)\/(login|register)$/.test(location.pathname);
    const isPracticeInterview = surface === "practice" && location.pathname.startsWith("/practice/interviews/");

    useEffect(() => {
        if (user?._id) setWorkspacePreference(config.workspace, user._id);
        else setWorkspacePreference(config.workspace);
    }, [config.workspace, user?._id]);

    useEffect(() => {
        setMobileAnchor(null);
        setProfileAnchor(null);
        setOrganizationAnchor(null);
        setWorkspaceAnchor(null);
        setResumeAnchor(null);
        setNotificationAnchor(null);
    }, [location.pathname, location.search, location.hash]);

    const hasHiringOrganization = Boolean(activeOrganization?._id);
    const hiringHome = hasHiringOrganization ? hiringHomeForRole(currentRole) : "/hire/team";
    const home = user ? (surface === "hiring" ? hiringHome : config.appHome) : config.publicHome;
    const resumeActive = PRACTICE_RESUME_ITEMS.some((item) => location.pathname === item.path);

    const navigation = useMemo(() => {
        if (!user) return [];
        if (surface === "practice") {
            return [
                { label: "Overview", path: "/practice/dashboard", paths: ["/practice/dashboard", "/practice/new"], matchPrefix: "/practice/interviews/" },
                { label: "Company insights", path: "/practice/company-insights", paths: ["/practice/company-insights", "/practice/saved-experiences"] },
                { label: "Progress", path: "/practice/progress" },
            ];
        }

        const items = [];
        if (!hasHiringOrganization) return [{ label: "Set up Hire", path: "/hire/team" }];
        if (permissions.canViewOverview) items.push({ label: "Overview", path: "/hire/assessments" });
        if (permissions.canViewCandidatePipeline) items.push({ label: "Candidates", path: "/hire/assessments", hash: "#candidate-pipeline" });
        if (permissions.canViewAssessments) items.push({ label: "Assessments", path: "/hire/assessments", hash: "#assessment-list", matchPrefix: "/hire/assessments/" });
        if (permissions.canManageOrganization) items.push({ label: "Team & billing", path: "/hire/team" });
        return items;
    }, [hasHiringOrganization, permissions.canManageOrganization, permissions.canViewAssessments, permissions.canViewCandidatePipeline, permissions.canViewOverview, surface, user]);

    const openNavItem = (item) => {
        const destination = `${item.path}${item.hash || ""}`;
        setMobileAnchor(null);
        setResumeAnchor(null);
        navigate(destination);
        if (item.hash) window.requestAnimationFrame(() => document.querySelector(item.hash)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };

    const handleLogout = async () => {
        await logout();
        navigate(config.publicHome, { replace: true });
    };

    const openPrimaryAction = () => {
        setMobileAnchor(null);
        if (surface === "hiring") navigate("/hire/assessments?create=1", { state: { openCreate: Date.now() } });
        else navigate("/practice/new");
    };

    const switchWorkspace = (nextWorkspace) => {
        setWorkspaceAnchor(null);
        setMobileAnchor(null);
        if (nextWorkspace === config.workspace) return;
        if (user?._id) setWorkspacePreference(nextWorkspace, user._id);
        navigate(user ? productHomePath(nextWorkspace) : CONFIG[nextWorkspace].publicHome);
    };

    const openOtherProduct = () => switchWorkspace(surface === "hiring" ? "practice" : "hiring");

    const selectHiringOrganization = (organization) => {
        if (!organization?._id) return;
        selectOrganization(organization._id);
        setOrganizationAnchor(null);
        setMobileAnchor(null);
        navigate(hiringHomeForRole(organization.role));
    };

    const renderNavItem = (item, mobile = false) => {
        const active = isProductNavItemActive(location, item);
        if (mobile) {
            return <MenuItem key={`${item.label}-${item.hash || ""}`} onClick={() => openNavItem(item)} selected={active}>{item.label}</MenuItem>;
        }
        return <Button key={`${item.label}-${item.hash || ""}`} onClick={() => openNavItem(item)} sx={navButtonSx(active)}>{item.label}</Button>;
    };

    const themeToggle = (
        <Tooltip title={mode === "dark" ? "Use light theme" : "Use dark theme"}>
            <IconButton onClick={toggle} aria-label="Toggle theme">{mode === "dark" ? <LightMode /> : <DarkMode />}</IconButton>
        </Tooltip>
    );

    if (isAuthScreen) {
        return (
            <AppBar position="sticky" color="transparent" elevation={0} sx={{ bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider", color: "text.primary", zIndex: 1200 }}>
                <Container maxWidth="xl">
                    <Toolbar disableGutters sx={{ minHeight: { xs: 64, md: 72 }, gap: 1 }}>
                        <ProductBrand config={config} surface={surface} to={config.publicHome} />
                        <Stack direction="row" spacing={.5} alignItems="center" sx={{ ml: "auto" }}>
                            <Button component={RouterLink} to={config.publicHome} color="inherit" startIcon={<ArrowBackRounded />} sx={{ display: { xs: "none", sm: "inline-flex" } }}>Back to {config.label}</Button>
                            {themeToggle}
                        </Stack>
                    </Toolbar>
                </Container>
            </AppBar>
        );
    }

    if (isPracticeInterview) {
        return (
            <AppBar position="sticky" color="transparent" elevation={0} sx={{ bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider", color: "text.primary", zIndex: 1200 }}>
                <Container maxWidth="xl">
                    <Toolbar disableGutters sx={{ minHeight: { xs: 64, md: 72 }, gap: 1 }}>
                        <ProductBrand config={config} surface={surface} interactive={false} />
                        <Typography variant="body2" color="text.secondary" fontWeight={750} sx={{ ml: { xs: 1, sm: 2 }, display: { xs: "none", sm: "block" } }}>Interview in progress</Typography>
                        <Stack direction="row" spacing={.5} alignItems="center" sx={{ ml: "auto" }}>
                            {themeToggle}
                            <Button component={RouterLink} to="/practice/dashboard" color="inherit">Exit interview</Button>
                        </Stack>
                    </Toolbar>
                </Container>
            </AppBar>
        );
    }

    return (
        <>
            <AppBar position="sticky" color="transparent" elevation={0} sx={{ bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider", color: "text.primary", backdropFilter: "blur(18px)", zIndex: 1200 }}>
                <Container maxWidth="xl">
                    <Toolbar disableGutters sx={{ minHeight: { xs: 64, md: 72 }, gap: 1 }}>
                        <ProductBrand config={config} surface={surface} to={home} />

                        {user && <>
                            <Button
                                color="inherit"
                                size="small"
                                endIcon={<ExpandMoreRounded />}
                                onClick={(event) => setWorkspaceAnchor(event.currentTarget)}
                                aria-label="Switch workspace"
                                sx={{ textTransform: "none", fontWeight: 800, ml: { xs: .25, sm: .75 }, minWidth: 0 }}
                            >
                                {config.label}
                            </Button>
                            <Menu anchorEl={workspaceAnchor} open={Boolean(workspaceAnchor?.isConnected)} onClose={() => setWorkspaceAnchor(null)}>
                                <MenuItem selected={surface === "practice"} onClick={() => switchWorkspace("practice")}><SchoolOutlined sx={{ mr: 1.25 }} />Practice</MenuItem>
                                <MenuItem selected={surface === "hiring"} onClick={() => switchWorkspace("hiring")}><WorkOutlineRounded sx={{ mr: 1.25 }} />Hire</MenuItem>
                            </Menu>
                        </>}

                        {surface === "hiring" && user && hasHiringOrganization && organizations.length > 0 && <>
                            <Button
                                color="inherit"
                                size="small"
                                endIcon={organizations.length > 1 ? <ExpandMoreRounded /> : undefined}
                                onClick={(event) => organizations.length > 1 && setOrganizationAnchor(event.currentTarget)}
                                sx={{ display: { xs: "none", sm: "inline-flex" }, maxWidth: 190, textTransform: "none", ml: .25 }}
                                aria-label="Hiring organization"
                            >
                                <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeOrganization?.name}</Box>
                            </Button>
                            <Menu anchorEl={organizationAnchor} open={Boolean(organizationAnchor?.isConnected)} onClose={() => setOrganizationAnchor(null)}>
                                {organizations.map((organization) => (
                                    <MenuItem key={organization._id} selected={organization._id === activeOrganization?._id} onClick={() => selectHiringOrganization(organization)}>
                                        <ListItemText primary={organization.name} secondary={organization.role?.replaceAll("_", " ")} />
                                    </MenuItem>
                                ))}
                            </Menu>
                        </>}

                        <Stack direction="row" spacing={.25} alignItems="center" sx={{ ml: "auto", display: { xs: "none", lg: "flex" } }}>
                            {surface === "practice" && user ? <>
                                {renderNavItem(navigation[0])}
                                <Button endIcon={<ExpandMoreRounded />} onClick={(event) => setResumeAnchor(event.currentTarget)} sx={navButtonSx(resumeActive)}>Resume</Button>
                                <Menu anchorEl={resumeAnchor} open={Boolean(resumeAnchor?.isConnected)} onClose={() => setResumeAnchor(null)}>
                                    {PRACTICE_RESUME_ITEMS.map((item) => <MenuItem key={item.path} selected={location.pathname === item.path} onClick={() => openNavItem(item)}>{item.label}</MenuItem>)}
                                </Menu>
                                {navigation.slice(1).map((item) => renderNavItem(item))}
                            </> : navigation.map((item) => renderNavItem(item))}

                            {user && (surface === "practice" || permissions.canManageAssessments) && (
                                <Button variant="contained" startIcon={<AddRounded />} onClick={openPrimaryAction} sx={{ ml: 1 }}>
                                    {surface === "hiring" ? "New assessment" : "New practice"}
                                </Button>
                            )}

                            {!user && !loading && <>
                                <Button component={RouterLink} to={config.crossPath} color="inherit">{surface === "hiring" ? "For candidates" : "For hiring teams"}</Button>
                                <Button component={RouterLink} to={productLoginPath(config.workspace)} color="inherit">Sign in</Button>
                                <Button component={RouterLink} to={productRegisterPath(config.workspace)} variant="contained">{surface === "hiring" ? "Start hiring" : "Start practicing"}</Button>
                            </>}
                        </Stack>

                        <Stack direction="row" spacing={.15} alignItems="center" sx={{ ml: { xs: "auto", lg: .75 } }}>
                            {themeToggle}
                            {user && <>
                                <Tooltip title="Notifications">
                                    <IconButton onClick={(event) => setNotificationAnchor(event.currentTarget)} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}>
                                        <Badge color="error" badgeContent={unreadCount} max={9}><NotificationsNoneRounded /></Badge>
                                    </IconButton>
                                </Tooltip>
                                <Menu anchorEl={notificationAnchor} open={Boolean(notificationAnchor?.isConnected)} onClose={() => setNotificationAnchor(null)} PaperProps={{ sx: { width: 390, maxWidth: "calc(100vw - 24px)", maxHeight: 460 } }}>
                                    <Stack direction="row" alignItems="center" justifyContent="space-between" px={2} py={1.25}>
                                        <Box><Typography fontWeight={850}>Notifications</Typography><Typography variant="caption" color="text.secondary">{unreadCount ? `${unreadCount} unread` : "You're all caught up"}</Typography></Box>
                                        {unreadCount > 0 && <Button size="small" onClick={markAllRead}>Mark read</Button>}
                                    </Stack>
                                    <Divider />
                                    {notifications.length === 0 ? (
                                        <Box px={2} py={3}><Typography variant="body2" color="text.secondary">No notifications yet.</Typography></Box>
                                    ) : notifications.slice(0, 8).map((notification) => (
                                        <MenuItem key={notification.id || notification._id} onClick={() => { markNotificationRead(notification.id || notification._id); if (notification.href) navigate(notification.href); }}>
                                            <ListItemText primary={notification.title || notification.message || "Notification"} secondary={notification.body || null} primaryTypographyProps={{ fontWeight: notification.read ? 500 : 800, noWrap: true }} secondaryTypographyProps={{ noWrap: true }} />
                                        </MenuItem>
                                    ))}
                                </Menu>

                                <Tooltip title="Account">
                                    <IconButton onClick={(event) => setProfileAnchor(event.currentTarget)} aria-label="Account menu" sx={{ display: { xs: "none", sm: "inline-flex" } }}>
                                        <Avatar sx={{ width: 34, height: 34 }}>{user?.name?.trim()?.[0]?.toUpperCase() || "U"}</Avatar>
                                    </IconButton>
                                </Tooltip>
                                <Menu anchorEl={profileAnchor} open={Boolean(profileAnchor?.isConnected)} onClose={() => setProfileAnchor(null)} PaperProps={{ sx: { minWidth: 250 } }}>
                                    <Box px={2} py={1.25}><Typography fontWeight={850}>{user?.name || "Account"}</Typography><Typography variant="caption" color="text.secondary">{user?.email}</Typography></Box>
                                    <Divider />
                                    {surface === "practice" && <MenuItem component={RouterLink} to="/practice/profile"><PersonOutlineRounded sx={{ mr: 1.25 }} />Profile</MenuItem>}
                                    <MenuItem onClick={openOtherProduct}><SwapHorizRounded sx={{ mr: 1.25 }} />{config.crossLabel}</MenuItem>
                                    <MenuItem onClick={() => { setProfileAnchor(null); setFeedbackOpen(true); }}><RateReviewOutlined sx={{ mr: 1.25 }} />Send feedback</MenuItem>
                                    {user?.role === "admin" && <MenuItem component={RouterLink} to="/admin"><SettingsOutlined sx={{ mr: 1.25 }} />Admin</MenuItem>}
                                    <Divider />
                                    <MenuItem onClick={handleLogout}><LogoutRounded sx={{ mr: 1.25 }} />Sign out</MenuItem>
                                </Menu>
                            </>}

                            <IconButton onClick={(event) => setMobileAnchor(event.currentTarget)} aria-label="Open navigation" sx={{ display: { xs: "inline-flex", lg: "none" } }}><MenuIcon /></IconButton>
                            <Menu anchorEl={mobileAnchor} open={Boolean(mobileAnchor?.isConnected)} onClose={() => setMobileAnchor(null)} PaperProps={{ sx: { minWidth: 280, maxHeight: "calc(100dvh - 90px)" } }}>
                                {user ? <>
                                    <Typography variant="overline" color="text.secondary" fontWeight={800} sx={{ px: 2, pt: 1 }}>Workspace</Typography>
                                    <MenuItem selected={surface === "practice"} onClick={() => switchWorkspace("practice")}><SchoolOutlined sx={{ mr: 1.25 }} />Practice</MenuItem>
                                    <MenuItem selected={surface === "hiring"} onClick={() => switchWorkspace("hiring")}><WorkOutlineRounded sx={{ mr: 1.25 }} />Hire</MenuItem>

                                    {surface === "hiring" && organizations.length > 0 && <>
                                        <Divider />
                                        <Typography variant="overline" color="text.secondary" fontWeight={800} sx={{ px: 2, pt: 1 }}>Organization</Typography>
                                        {organizations.map((organization) => (
                                            <MenuItem key={organization._id} selected={organization._id === activeOrganization?._id} onClick={() => selectHiringOrganization(organization)}>
                                                <ListItemText primary={organization.name} secondary={organization.role?.replaceAll("_", " ")} />
                                            </MenuItem>
                                        ))}
                                    </>}

                                    <Divider />
                                    {surface === "practice" ? <>
                                        {renderNavItem(navigation[0], true)}
                                        <Typography variant="overline" color="text.secondary" fontWeight={800} sx={{ px: 2, pt: 1 }}>Resume</Typography>
                                        {PRACTICE_RESUME_ITEMS.map((item) => <MenuItem key={item.path} selected={location.pathname === item.path} onClick={() => openNavItem(item)}>{item.label}</MenuItem>)}
                                        {navigation.slice(1).map((item) => renderNavItem(item, true))}
                                    </> : navigation.map((item) => renderNavItem(item, true))}

                                    {(surface === "practice" || permissions.canManageAssessments) && <MenuItem onClick={openPrimaryAction}><AddRounded sx={{ mr: 1.25 }} />{surface === "hiring" ? "New assessment" : "New practice"}</MenuItem>}
                                    <Divider />
                                    {surface === "practice" && <MenuItem component={RouterLink} to="/practice/profile" onClick={() => setMobileAnchor(null)}><PersonOutlineRounded sx={{ mr: 1.25 }} />Profile</MenuItem>}
                                    <MenuItem onClick={() => { setMobileAnchor(null); setFeedbackOpen(true); }}><RateReviewOutlined sx={{ mr: 1.25 }} />Send feedback</MenuItem>
                                    {user?.role === "admin" && <MenuItem component={RouterLink} to="/admin/overview" onClick={() => setMobileAnchor(null)}><SettingsOutlined sx={{ mr: 1.25 }} />Admin</MenuItem>}
                                    <MenuItem onClick={handleLogout}><LogoutRounded sx={{ mr: 1.25 }} />Sign out</MenuItem>
                                </> : <>
                                    <MenuItem component={RouterLink} to={config.crossPath}>{surface === "hiring" ? "For candidates" : "For hiring teams"}</MenuItem>
                                    <MenuItem component={RouterLink} to={productLoginPath(config.workspace)}>Sign in</MenuItem>
                                    <MenuItem component={RouterLink} to={productRegisterPath(config.workspace)}>{surface === "hiring" ? "Start hiring" : "Start practicing"}</MenuItem>
                                </>}
                            </Menu>
                        </Stack>
                    </Toolbar>
                </Container>
            </AppBar>
            <ProductFeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
        </>
    );
}
