import { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { AuthContext } from "../context/AuthContext";
import { getWorkspaceHome, getWorkspacePreference } from "../utils/workspacePreference";

export default function GuestOnlyRoute({ children }) {
    const { user, loading } = useContext(AuthContext);
    const location = useLocation();

    if (loading) return <Box sx={{ minHeight: "60vh", display: "grid", placeItems: "center" }}><CircularProgress /></Box>;

    const requested = location.state?.from;
    const requestedDestination = requested?.pathname
        ? `${requested.pathname}${requested.search || ""}${requested.hash || ""}`
        : null;
    const workspaceParam = new URLSearchParams(location.search).get("workspace");
    const explicitWorkspaceDestination = workspaceParam === "hiring"
        ? "/assessments"
        : workspaceParam === "practice"
            ? "/dashboard"
            : null;
    const workspaceDestination = getWorkspaceHome(getWorkspacePreference(user?._id) || "practice");

    return user ? <Navigate to={requestedDestination || explicitWorkspaceDestination || workspaceDestination} replace /> : children;
}
