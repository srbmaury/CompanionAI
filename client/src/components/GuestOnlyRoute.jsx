import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { AuthContext } from "../context/AuthContext";

export default function GuestOnlyRoute({ children }) {
    const { user, loading } = useContext(AuthContext);
    if (loading) return <Box sx={{ minHeight: "60vh", display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
    return user ? <Navigate to="/dashboard" replace /> : children;
}
