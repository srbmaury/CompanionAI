import { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
    const { user, loading } = useContext(AuthContext); // get from context
    const location = useLocation();

    // While checking session (cookies), don’t redirect yet
    if (loading) {
        return <div>Loading...</div>; // or spinner
    }

    // If not logged in and NOT already at /login → redirect
    if (!user && location.pathname !== "/login") {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
}
