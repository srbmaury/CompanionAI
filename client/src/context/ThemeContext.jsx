/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

export const ThemeModeContext = createContext({ mode: "light", toggle: () => {} });

export const useThemeMode = () => useContext(ThemeModeContext);

export const ThemeModeProvider = ({ children }) => {
    const [mode, setMode] = useState(() => {
        if (typeof window === "undefined") return "light";
        const saved = window.localStorage.getItem("ia:theme");
        return saved === "dark" || saved === "light" ? saved : "light";
    });

    useEffect(() => {
        try {
            window.localStorage.setItem("ia:theme", mode);
        } catch { /* Storage can be unavailable in privacy mode. */ }
        try {
            const root = document.documentElement;
            if (mode === "dark") {
                root.classList.add("dark");
            } else {
                root.classList.remove("dark");
            }
        } catch { /* DOM access can be unavailable during non-browser rendering. */ }
    }, [mode]);

    const toggle = useCallback(() => {
        setMode((currentMode) => (currentMode === "light" ? "dark" : "light"));
    }, []);

    const muiTheme = useMemo(() => createTheme({ palette: { mode } }), [mode]);

    const value = useMemo(() => ({ mode, toggle }), [mode, toggle]);

    return (
        <ThemeModeContext.Provider value={value}>
            <ThemeProvider theme={muiTheme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ThemeModeContext.Provider>
    );
};
