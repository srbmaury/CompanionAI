const ROOT_PATHS = new Set([
    "/",
    "/login",
    "/register",
    "/verify-email",
    "/forgot-password",
    "/reset-password",
    "/privacy",
    "/terms",
    "/dashboard",
    "/resume-review",
    "/progress",
    "/experiences",
    "/profile",
    "/pricing",
    "/billing/success",
    "/admin/feedback",
    "/admin/audit",
    "/hiring/team",
]);

export const isGlobalNavigationRoot = ({ pathname, search = "" }) => {
    if (!pathname) return true;
    if (ROOT_PATHS.has(pathname)) return true;
    if (pathname.startsWith("/assessment/")) return true;

    // Hiring overview, candidate pipeline, and assessment list are sibling root views.
    // The builder is intentionally nested so /assessments?create=1 keeps a Back action.
    if (pathname === "/assessments") return !search;

    return false;
};

export const shouldShowGlobalBack = (location) => !isGlobalNavigationRoot(location);
