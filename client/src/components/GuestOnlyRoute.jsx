import { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { AuthContext } from "../context/AuthContext";

export default function GuestOnlyRoute({ children }) {
    const { user, loading } = useContext(AuthContext);
    const location = useLocation();

    if (loading) return <Box sx={{ minHeight: "60vh", display: "grid", placeItems: "center" }}><CircularProgress /></Box>;

    const requested = location.state?.from;
    const requestedDestination = requested?.pathname
        ? `${requested.pathname}${requested.search || ""}${requested.hash || ""}`
        : null;
    const workspaceDestination = typeof localStorage !== "undefined" && localStorage.getItem("companionai:workspace") === "hiring"
        ? "/assessments"
        : "/dashboard";

    return user ? <Navigate to={requestedDestination || workspaceDestination} replace /> : children;
}
