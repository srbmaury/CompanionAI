import { Navigate, useLocation } from "react-router-dom";
import { canonicalProductPath } from "../utils/productRoutes";

export default function CanonicalProductRedirect() {
    const location = useLocation();

    if (location.pathname === "/billing/success") {
        const params = new URLSearchParams(location.search || "");
        if (params.get("product") === "hiring") {
            const next = new URLSearchParams();
            next.set("billing", "success");
            if (params.get("purchase")) next.set("purchase", params.get("purchase"));
            if (params.get("organizationId")) next.set("organizationId", params.get("organizationId"));
            return <Navigate to={`/hire/team?${next.toString()}`} replace />;
        }
    }

    const canonicalPath = canonicalProductPath(location.pathname);
    const destination = `${canonicalPath}${location.search || ""}${location.hash || ""}`;

    if (!canonicalPath || canonicalPath === location.pathname) {
        return <Navigate to="/" replace />;
    }

    return <Navigate to={destination} replace />;
}
