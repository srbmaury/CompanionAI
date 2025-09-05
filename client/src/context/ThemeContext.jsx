import { createContext, useContext, useEffect, useMemo, useState } from "react";
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
        } catch {}
        try {
            const root = document.documentElement;
            if (mode === "dark") {
                root.classList.add("dark");
            } else {
                root.classList.remove("dark");
            }
        } catch {}
    }, [mode]);

    const toggle = () => setMode((m) => (m === "light" ? "dark" : "light"));

    const muiTheme = useMemo(() => createTheme({ palette: { mode } }), [mode]);

    const value = useMemo(() => ({ mode, toggle }), [mode]);

    return (
        <ThemeModeContext.Provider value={value}>
            <ThemeProvider theme={muiTheme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ThemeModeContext.Provider>
    );
};
