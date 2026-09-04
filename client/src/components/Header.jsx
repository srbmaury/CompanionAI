import { useContext, useEffect, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import {
    DarkMode,
    LightMode,
    LogoutRounded,
    Menu as MenuIcon,
    NotificationsNoneRounded,
    RateReviewOutlined,
    SettingsOutlined,
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
    Skeleton,
    Stack,
    Toolbar,
    Tooltip,
    Typography,
} from "@mui/material";
import { AuthContext } from "../context/AuthContext";
import { useThemeMode } from "../context/ThemeContext";
import { useNotifications } from "../context/NotificationContext";
import ProductFeedbackDialog from "./ProductFeedbackDialog";

const Brand = ({ to = "/" }) => (
    <Typography
        component={RouterLink}
        to={to}
        variant="h6"
        sx={{ display: "flex", alignItems: "center", gap: 1.15, textDecoration: "none", color: "inherit", fontWeight: 850, letterSpacing: "-.025em" }}
    >
        <Box component="span" sx={{ width: 34, height: 34, borderRadius: 2.5, display: "grid", placeItems: "center", color: "white", background: "linear-gradient(135deg,#5b50d6,#8f85ff)", boxShadow: "0 8px 20px rgba(91,80,214,.28)", fontSize: 16 }}>C</Box>
        <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>CompanionAI</Box>
    </Typography>
);

export default function Header() {
    const { user, loading, logout } = useContext(AuthContext);
    const { mode, toggle } = useThemeMode();
    const { notifications, unreadCount, markNotificationRead, markAllRead } = useNotifications();
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileAnchor, setMobileAnchor] = useState(null);
    const [profileAnchor, setProfileAnchor] = useState(null);
    const [notificationAnchor, setNotificationAnchor] = useState(null);
    const [feedbackOpen, setFeedbackOpen] = useState(false);

    const isCandidateAssessment = location.pathname.startsWith("/assessment/");
    const isAdmin = Boolean(user?.role === "admin");

    useEffect(() => {
        setMobileAnchor(null);
        setProfileAnchor(null);
        setNotificationAnchor(null);
    }, [location.pathname, location.search, location.hash]);

    const handleLogout = async () => {
        await logout();
        navigate("/", { replace: true });
    };

    const closeMobile = () => setMobileAnchor(null);

    return (
        <>
            <AppBar position="sticky" color="transparent" elevation={0} sx={{ bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider", color: "text.primary", backdropFilter: "blur(18px)", zIndex: 1200 }}>
                <Container maxWidth="xl">
                    <Toolbar disableGutters sx={{ minHeight: { xs: 64, md: 72 }, gap: 1 }}>
                        <Brand to={user && isAdmin ? "/admin/feedback" : "/"} />

                        {isCandidateAssessment ? (
                            <Stack direction="row" spacing={.5} alignItems="center" sx={{ ml: "auto" }}>
                                <Button component={RouterLink} to="/privacy" color="inherit">Privacy</Button>
                                <Tooltip title={mode === "dark" ? "Use light theme" : "Use dark theme"}>
                                    <IconButton onClick={toggle} aria-label="Toggle theme">{mode === "dark" ? <LightMode /> : <DarkMode />}</IconButton>
                                </Tooltip>
                            </Stack>
                        ) : loading ? (
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: "auto" }} aria-label="Restoring your session">
                                <Skeleton variant="rounded" width={88} height={36} />
                                <Skeleton variant="circular" width={36} height={36} />
                            </Stack>
                        ) : (
                            <>
                                <Stack direction="row" spacing={.35} alignItems="center" sx={{ ml: "auto", display: { xs: "none", md: "flex" } }}>
                                    <Button component={RouterLink} to="/practice" color="inherit">Practice</Button>
                                    <Button component={RouterLink} to="/hire" color="inherit">Hire</Button>
                                    {isAdmin && <>
                                        <Button component={RouterLink} to="/admin/feedback" color="inherit">Feedback</Button>
                                        <Button component={RouterLink} to="/admin/audit" color="inherit">Audit</Button>
                                        <Button component={RouterLink} to="/admin/calibration" color="inherit">AI calibration</Button>
                                    </>}
                                    {!user && <Button component={RouterLink} to="/login" variant="contained">Sign in</Button>}
                                </Stack>

                                <Stack direction="row" spacing={.2} alignItems="center" sx={{ ml: { xs: "auto", md: 1 } }}>
                                    <Tooltip title={mode === "dark" ? "Use light theme" : "Use dark theme"}>
                                        <IconButton onClick={toggle} aria-label="Toggle theme">{mode === "dark" ? <LightMode /> : <DarkMode />}</IconButton>
                                    </Tooltip>

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
                                            <IconButton onClick={(event) => setProfileAnchor(event.currentTarget)} aria-label="Account menu" sx={{ display: { xs: "none", md: "inline-flex" } }}>
                                                <Avatar sx={{ width: 34, height: 34 }}>{user?.name?.trim()?.[0]?.toUpperCase() || "U"}</Avatar>
                                            </IconButton>
                                        </Tooltip>
                                        <Menu anchorEl={profileAnchor} open={Boolean(profileAnchor?.isConnected)} onClose={() => setProfileAnchor(null)} PaperProps={{ sx: { minWidth: 250 } }}>
                                            <Box px={2} py={1.25}><Typography fontWeight={850}>{user?.name || "Account"}</Typography><Typography variant="caption" color="text.secondary">{user?.email}</Typography></Box>
                                            <Divider />
                                            <MenuItem component={RouterLink} to="/practice/profile"><SettingsOutlined sx={{ mr: 1.25 }} />Profile & settings</MenuItem>
                                            <MenuItem onClick={() => { setProfileAnchor(null); setFeedbackOpen(true); }}><RateReviewOutlined sx={{ mr: 1.25 }} />Send feedback</MenuItem>
                                            <Divider />
                                            <MenuItem onClick={handleLogout}><LogoutRounded sx={{ mr: 1.25 }} />Sign out</MenuItem>
                                        </Menu>
                                    </>}

                                    <IconButton onClick={(event) => setMobileAnchor(event.currentTarget)} aria-label="Open navigation" sx={{ display: { xs: "inline-flex", md: "none" } }}><MenuIcon /></IconButton>
                                    <Menu anchorEl={mobileAnchor} open={Boolean(mobileAnchor?.isConnected)} onClose={closeMobile} PaperProps={{ sx: { minWidth: 250 } }}>
                                        <MenuItem component={RouterLink} to="/practice" onClick={closeMobile}>Practice</MenuItem>
                                        <MenuItem component={RouterLink} to="/hire" onClick={closeMobile}>Hire</MenuItem>
                                        {isAdmin && <>
                                            <Divider />
                                            <MenuItem component={RouterLink} to="/admin/feedback" onClick={closeMobile}>Feedback</MenuItem>
                                            <MenuItem component={RouterLink} to="/admin/audit" onClick={closeMobile}>Audit</MenuItem>
                                            <MenuItem component={RouterLink} to="/admin/calibration" onClick={closeMobile}>AI calibration</MenuItem>
                                        </>}
                                        {user ? <>
                                            <Divider />
                                            <MenuItem component={RouterLink} to="/practice/profile" onClick={closeMobile}>Profile & settings</MenuItem>
                                            <MenuItem onClick={() => { closeMobile(); setFeedbackOpen(true); }}><RateReviewOutlined fontSize="small" sx={{ mr: 1.25 }} />Send feedback</MenuItem>
                                            <MenuItem onClick={handleLogout}><LogoutRounded fontSize="small" sx={{ mr: 1.25 }} />Sign out</MenuItem>
                                        </> : <>
                                            <Divider />
                                            <MenuItem component={RouterLink} to="/login" onClick={closeMobile}>Sign in</MenuItem>
                                        </>}
                                    </Menu>
                                </Stack>
                            </>
                        )}
                    </Toolbar>
                </Container>
            </AppBar>
            <ProductFeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
        </>
    );
}
