import { Alert, Snackbar } from "@mui/material";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

const STORAGE_KEY = "companionai:notifications";
const VALID_SEVERITIES = new Set(["info", "success", "warning", "error"]);
const normalizeHistory = (value) => Array.isArray(value) ? value.filter((item) => item?.message).map((item) => ({ ...item, read: Boolean(item.read) })).slice(0, 30) : [];
const readHistory = () => { try { return normalizeHistory(JSON.parse(window.sessionStorage?.getItem(STORAGE_KEY) || "[]")); } catch { return []; } };
const writeHistory = (items) => { try { window.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* Continue without history persistence. */ } };
const NotificationContext = createContext({ notify: () => {}, notifications: [], unreadCount: 0, markNotificationRead: () => {}, markAllRead: () => {}, dismissNotification: () => {}, clearNotifications: () => {} });

export function NotificationProvider({ children }) {
    const [notification, setNotification] = useState(null);
    const [notifications, setNotifications] = useState(readHistory);

    const updateHistory = useCallback((updater) => {
        setNotifications((current) => {
            const next = normalizeHistory(typeof updater === "function" ? updater(current) : updater);
            writeHistory(next);
            return next;
        });
    }, []);

    const notify = useCallback((message, severity = "info") => {
        const cleanMessage = String(message || "").trim();
        if (!cleanMessage) return;
        const safeSeverity = VALID_SEVERITIES.has(severity) ? severity : "info";
        const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, message: cleanMessage, severity: safeSeverity, at: new Date().toISOString(), read: false };
        setNotification(item);
        updateHistory((current) => {
            const previous = current[0];
            const duplicate = previous && previous.message === cleanMessage && previous.severity === safeSeverity && Date.now() - new Date(previous.at).getTime() < 2000;
            return duplicate ? [{ ...previous, at: item.at, read: false }, ...current.slice(1)] : [item, ...current];
        });
    }, [updateHistory]);

    const markNotificationRead = useCallback((id) => updateHistory((current) => current.map((item) => item.id === id ? { ...item, read: true } : item)), [updateHistory]);
    const markAllRead = useCallback(() => updateHistory((current) => current.map((item) => item.read ? item : { ...item, read: true })), [updateHistory]);
    const dismissNotification = useCallback((id) => updateHistory((current) => current.filter((item) => item.id !== id)), [updateHistory]);
    const clearNotifications = useCallback(() => { setNotifications([]); try { window.sessionStorage?.removeItem(STORAGE_KEY); } catch { /* no-op */ } }, []);
    const unreadCount = useMemo(() => notifications.reduce((count, item) => count + (item.read ? 0 : 1), 0), [notifications]);
    const close = useCallback((_, reason) => { if (reason !== "clickaway") setNotification(null); }, []);
    const autoHideDuration = notification?.severity === "error" ? 7000 : notification?.severity === "warning" ? 5500 : notification?.severity === "success" ? 3500 : 4500;
    const value = useMemo(() => ({ notify, notifications, unreadCount, markNotificationRead, markAllRead, dismissNotification, clearNotifications }), [notify, notifications, unreadCount, markNotificationRead, markAllRead, dismissNotification, clearNotifications]);

    return <NotificationContext.Provider value={value}>{children}<Snackbar key={notification?.id} open={Boolean(notification)} autoHideDuration={autoHideDuration} onClose={close} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} sx={{ bottom: { xs: 16, sm: 24 }, maxWidth: "calc(100vw - 24px)" }}><Alert onClose={close} severity={notification?.severity || "info"} variant="filled" elevation={8} role={notification?.severity === "error" ? "alert" : "status"} sx={{ width: "100%", maxWidth: 560 }}>{notification?.message}</Alert></Snackbar></NotificationContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotify() {
    return useContext(NotificationContext).notify;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
    return useContext(NotificationContext);
}
