import { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { Box, CircularProgress } from "@mui/material";
import { productLoginPath, surfaceForPath, workspaceForSurface } from "../utils/productRoutes";

export default function ProtectedRoute({ children }) {
    const { user, loading } = useContext(AuthContext);
    const location = useLocation();

    if (loading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!user) {
        const workspace = workspaceForSurface(surfaceForPath(location.pathname));
        return <Navigate to={productLoginPath(workspace)} state={{ from: location }} replace />;
    }

    return children;
}
