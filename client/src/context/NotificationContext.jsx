import { Alert, Snackbar } from "@mui/material";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

const readHistory = () => { try { return JSON.parse(window.sessionStorage?.getItem("companionai:notifications") || "[]"); } catch { return []; } };
const NotificationContext = createContext({ notify: () => {}, notifications: [], clearNotifications: () => {} });

export function NotificationProvider({ children }) {
    const [notification, setNotification] = useState(null);
    const [notifications, setNotifications] = useState(readHistory);
    const notify = useCallback((message, severity = "info") => {
        if (!message) return;
        const item = { id: Date.now(), message, severity, at: new Date().toISOString() };
        setNotification(item);
        setNotifications((current) => { const next = [item, ...current].slice(0, 20); try { window.sessionStorage?.setItem("companionai:notifications", JSON.stringify(next)); } catch { /* Continue without history persistence. */ } return next; });
    }, []);
    const clearNotifications = useCallback(() => { setNotifications([]); try { window.sessionStorage?.removeItem("companionai:notifications"); } catch { /* no-op */ } }, []);
    const close = useCallback((_, reason) => { if (reason !== "clickaway") setNotification(null); }, []);
    const value = useMemo(() => ({ notify, notifications, clearNotifications }), [notify, notifications, clearNotifications]);
    return <NotificationContext.Provider value={value}>{children}<Snackbar key={notification?.id} open={Boolean(notification)} autoHideDuration={notification?.severity === "error" ? 7000 : 4500} onClose={close} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} sx={{ bottom: { xs: 16, sm: 24 }, maxWidth: "calc(100vw - 24px)" }}><Alert onClose={close} severity={notification?.severity || "info"} variant="filled" elevation={8} role="status" sx={{ width: "100%", maxWidth: 560 }}>{notification?.message}</Alert></Snackbar></NotificationContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotify() {
    return useContext(NotificationContext).notify;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
    return useContext(NotificationContext);
}
