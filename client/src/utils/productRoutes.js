export const PRODUCT_SURFACES = Object.freeze({
    PRACTICE: "practice",
    HIRING: "hiring",
});

const PRACTICE_LEGACY_EXACT = new Map([
    ["/dashboard", "/practice/dashboard"],
    ["/experiences", "/practice/company-insights"],
    ["/profile", "/practice/profile"],
    ["/progress", "/practice/progress"],
    ["/resume-reviews", "/practice/resume-reviews"],
    ["/resume-match", "/practice/resume-match"],
    ["/saved-experiences", "/practice/saved-experiences"],
    ["/resumes", "/practice/resumes"],
    ["/pricing", "/practice/pricing"],
    ["/billing/success", "/practice/billing/success"],
    ["/create-interview", "/practice/new"],
    ["/resume-review", "/practice/resume-review"],
    ["/interview-practice", "/practice"],
]);

const HIRING_LEGACY_EXACT = new Map([
    ["/hiring/team", "/hire/team"],
    ["/hiring/sso", "/hire/sso"],
    ["/technical-hiring", "/hire"],
]);

export const workspaceForSurface = (surface) => (
    surface === PRODUCT_SURFACES.HIRING
        ? "hiring"
        : surface === PRODUCT_SURFACES.PRACTICE
            ? "practice"
            : null
);

export const surfaceForWorkspace = (workspace) => (
    workspace === "hiring"
        ? PRODUCT_SURFACES.HIRING
        : workspace === "practice"
            ? PRODUCT_SURFACES.PRACTICE
            : null
);

export const surfaceForPath = (pathname = "") => {
    if (/^\/hire(?:\/|$)/.test(pathname) || /^\/hiring(?:\/|$)/.test(pathname) || /^\/assessments(?:\/|$)/.test(pathname) || pathname === "/technical-hiring") {
        return PRODUCT_SURFACES.HIRING;
    }

    if (/^\/practice(?:\/|$)/.test(pathname) || /^\/interviews(?:\/|$)/.test(pathname) || PRACTICE_LEGACY_EXACT.has(pathname)) {
        return PRODUCT_SURFACES.PRACTICE;
    }

    return null;
};

export const productLandingPath = (workspace) => (
    workspace === "hiring" ? "/hire" : "/practice"
);

export const productHomePath = (workspace) => (
    workspace === "hiring" ? "/hire/assessments" : "/practice/dashboard"
);

export const productLoginPath = (workspace) => (
    workspace === "hiring" ? "/hire/login" : workspace === "practice" ? "/practice/login" : "/login"
);

export const productRegisterPath = (workspace) => (
    workspace === "hiring" ? "/hire/register" : workspace === "practice" ? "/practice/register" : "/register"
);

export const canonicalProductPath = (pathname = "") => {
    if (!pathname || /^\/(practice|hire)(?:\/|$)/.test(pathname) || /^\/assessment(?:\/|$)/.test(pathname)) {
        return pathname;
    }

    if (PRACTICE_LEGACY_EXACT.has(pathname)) return PRACTICE_LEGACY_EXACT.get(pathname);
    if (HIRING_LEGACY_EXACT.has(pathname)) return HIRING_LEGACY_EXACT.get(pathname);

    if (pathname === "/assessments" || pathname.startsWith("/assessments/")) {
        return `/hire${pathname}`;
    }
    if (pathname === "/interviews" || pathname.startsWith("/interviews/")) {
        return `/practice${pathname}`;
    }
    if (pathname.startsWith("/hiring/")) {
        return `/hire/${pathname.slice("/hiring/".length)}`;
    }

    return pathname;
};

export const isCanonicalProductPath = (pathname = "") => /^\/(practice|hire)(?:\/|$)/.test(pathname);
