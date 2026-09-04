import { Navigate, useLocation } from "react-router-dom";
import { canonicalProductPath } from "../utils/productRoutes";

export default function CanonicalProductRedirect() {
    const location = useLocation();
    const canonicalPath = canonicalProductPath(location.pathname);
    const destination = `${canonicalPath}${location.search || ""}${location.hash || ""}`;

    if (!canonicalPath || canonicalPath === location.pathname) {
        return <Navigate to="/" replace />;
    }

    return <Navigate to={destination} replace />;
}
