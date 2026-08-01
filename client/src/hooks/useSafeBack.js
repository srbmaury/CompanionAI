import { useCallback, useEffect } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";

const STORAGE_KEY = "companionai:navigation-history";
const readHistory = () => {
    try {
        const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
        return Array.isArray(value?.entries) && Number.isInteger(value?.cursor) ? value : { entries: [], cursor: -1 };
    } catch { return { entries: [], cursor: -1 }; }
};
const writeHistory = (value) => { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* storage may be unavailable */ } };

const fallbackFor = (pathname, signedIn) => {
    if (signedIn) {
        if (pathname.startsWith("/interviews/")) return "/dashboard";
        if (["/resume-reviews", "/saved-experiences", "/resumes", "/progress", "/pricing"].includes(pathname)) return "/profile";
        return "/dashboard";
    }
    if (["/forgot-password", "/reset-password", "/verify-email"].includes(pathname)) return "/login";
    return "/";
};

export default function useSafeBack(signedIn) {
    const navigate = useNavigate();
    const location = useLocation();
    const navigationType = useNavigationType();
    const fullPath = `${location.pathname}${location.search}${location.hash}`;

    useEffect(() => {
        const state = readHistory();
        const entry = { key: location.key, path: fullPath };
        if (state.entries[state.cursor]?.key === location.key && state.entries[state.cursor]?.path === fullPath) return;
        if (navigationType === "POP") {
            const existing = state.entries.findIndex((item) => item.key === location.key);
            if (existing >= 0) state.cursor = existing;
            else { state.entries = [...state.entries.slice(0, state.cursor + 1), entry]; state.cursor = state.entries.length - 1; }
        } else if (navigationType === "REPLACE" && state.cursor >= 0) {
            state.entries[state.cursor] = entry;
        } else {
            state.entries = [...state.entries.slice(0, state.cursor + 1), entry];
            state.cursor = state.entries.length - 1;
        }
        writeHistory(state);
    }, [fullPath, location.key, navigationType]);

    return useCallback(() => {
        const browserIndex = window.history.state?.idx;
        if (Number.isInteger(browserIndex) && browserIndex > 0) return navigate(-1);
        const state = readHistory();
        if (state.cursor > 0) {
            const target = state.entries[state.cursor - 1]?.path;
            if (target && target !== fullPath) {
                state.cursor -= 1;
                writeHistory(state);
                return navigate(target, { replace: true });
            }
        }
        return navigate(fallbackFor(location.pathname, signedIn), { replace: true });
    }, [fullPath, location.pathname, navigate, signedIn]);
}
