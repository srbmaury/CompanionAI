const ID_SEGMENT = /^(?:[a-f\d]{24}|\d+|[0-9a-f]{8}-[0-9a-f-]{27,}|[A-Za-z0-9_-]{32,})$/i;

export const normalizeRoute = (req) => {
    if (req?.route?.path) {
        const path = typeof req.route.path === "string" ? req.route.path : "matched";
        const original = String(req.originalUrl || req.path || "/").split("?")[0];
        if (path === "/") return original.replace(/\/+/g, "/") || "/";
        const routeParts = path.split("/").filter(Boolean);
        const originalParts = original.split("/").filter(Boolean);
        const prefix = originalParts.slice(0, Math.max(0, originalParts.length - routeParts.length));
        return `/${[...prefix, ...routeParts].join("/")}`.replace(/\/+/g, "/");
    }
    const path = String(req?.path || req?.originalUrl || "/").split("?")[0];
    if (!path.startsWith("/api") && ["/metrics", "/health/liveness", "/health/readiness"].includes(path)) return path;
    const normalized = path.split("/").map((part) => ID_SEGMENT.test(part) ? ":id" : part).join("/");
    return normalized.startsWith("/api") ? "unmatched_api" : normalized;
};

export default normalizeRoute;
