import { Alert, Snackbar } from "@mui/material";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

const NotificationContext = createContext({ notify: () => {} });

export function NotificationProvider({ children }) {
    const [notification, setNotification] = useState(null);
    const notify = useCallback((message, severity = "info") => {
        if (!message) return;
        setNotification({ id: Date.now(), message, severity });
    }, []);
    const close = useCallback((_, reason) => { if (reason !== "clickaway") setNotification(null); }, []);
    const value = useMemo(() => ({ notify }), [notify]);
    return <NotificationContext.Provider value={value}>{children}<Snackbar key={notification?.id} open={Boolean(notification)} autoHideDuration={notification?.severity === "error" ? 7000 : 4500} onClose={close} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} sx={{ bottom: { xs: 16, sm: 24 }, maxWidth: "calc(100vw - 24px)" }}><Alert onClose={close} severity={notification?.severity || "info"} variant="filled" elevation={8} role="status" sx={{ width: "100%", maxWidth: 560 }}>{notification?.message}</Alert></Snackbar></NotificationContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotify() {
    return useContext(NotificationContext).notify;
}
