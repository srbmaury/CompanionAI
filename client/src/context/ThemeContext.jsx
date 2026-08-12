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

    const muiTheme = useMemo(() => createTheme({
        palette: {
            mode,
            primary: { main: mode === "dark" ? "#958cff" : "#5b50d6", light: "#8f85ff", dark: "#4438b8" },
            secondary: { main: mode === "dark" ? "#45d5bd" : "#0e9f8a" },
            background: mode === "dark" ? { default: "#0b1020", paper: "#12182a" } : { default: "#fafbff", paper: "#ffffff" },
        },
        shape: { borderRadius: 14 },
        typography: {
            fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            button: { textTransform: "none", fontWeight: 700 },
        },
        components: {
            MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 11, minHeight: 40, whiteSpace: "normal", overflowWrap: "anywhere", textAlign: "center" }, containedPrimary: { boxShadow: "0 8px 22px rgba(91,80,214,.22)" } } },
            MuiCard: { styleOverrides: { root: { borderRadius: 18, backgroundImage: "none" } } },
            MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
            MuiTextField: { defaultProps: { variant: "outlined" } },
            MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 12 } } },
            MuiChip: { styleOverrides: { root: { fontWeight: 700, maxWidth: "100%", height: "auto", minHeight: 32 }, label: { whiteSpace: "normal", overflowWrap: "anywhere", paddingTop: 4, paddingBottom: 4 } } },
            MuiTypography: { styleOverrides: { root: { overflowWrap: "anywhere" } } },
            MuiAlert: { styleOverrides: { message: { minWidth: 0, overflowWrap: "anywhere" } } },
            MuiFormControlLabel: { styleOverrides: { root: { minWidth: 0 }, label: { minWidth: 0, overflowWrap: "anywhere" } } },
        },
    }), [mode]);

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
