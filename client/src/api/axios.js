import axios from "axios";

// Resolve API base URL (supports local proxy and absolute prod URL)
const resolveBaseUrl = () => {
    const envUrl = import.meta?.env?.VITE_API_BASE_URL;
    try {
        if (typeof window !== "undefined") {
            const hostname = window.location.hostname;
            const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
            if (isLocal && (!envUrl || envUrl.startsWith("/"))) return "/api";
        }
    } catch { /* ignore */ }
    return envUrl || "/api";
};

const api = axios.create({
    baseURL: resolveBaseUrl(),
    withCredentials: true,
});

// Cache latest CSRF token seen in headers as a fallback when cookie is unavailable cross-site
let latestCsrfToken = null;
let csrfPrimePromise = null;

const readCookieToken = () => {
    try {
        const match = document.cookie.match(/(?:^|; )csrfToken=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : null;
    } catch {
        return null;
    }
};

const getAbsoluteApiUrl = (path) => {
    try {
        const base = resolveBaseUrl();
        const baseTrimmed = String(base || "").replace(/\/+$/, "");
        const pathWithSlash = path.startsWith("/") ? path : `/${path}`;
        if (/^https?:\/\//i.test(baseTrimmed)) {
            return `${baseTrimmed}${pathWithSlash}`;
        }
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        return `${origin}${baseTrimmed}${pathWithSlash}`;
    } catch {
        return path;
    }
};

const primeAndGetCsrfToken = async () => {
    // Fast path from cookie or cached header
    const cookieToken = readCookieToken();
    if (cookieToken) return cookieToken;
    if (latestCsrfToken) return latestCsrfToken;

    // Debounce concurrent priming
    if (!csrfPrimePromise) {
        csrfPrimePromise = (async () => {
            try {
                const url = getAbsoluteApiUrl("/auth/profile");
                const resp = await window.fetch(url, {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        Accept: "application/json",
                    },
                });
                const headerToken = resp.headers.get("x-csrf-token") || resp.headers.get("X-CSRF-Token");
                if (headerToken) latestCsrfToken = headerToken;
            } catch { void 0; }
            try { await new Promise((r) => setTimeout(r, 0)); } catch { void 0; }
            return latestCsrfToken || readCookieToken();
        })().finally(() => {
            setTimeout(() => { csrfPrimePromise = null; }, 0);
        });
    }
    try {
        const token = await csrfPrimePromise;
        return token || null;
    } catch {
        return null;
    }
};

// Prime CSRF early (non-blocking)
try { api.get(`/auth/profile`).catch(() => { /* ignore */ }); } catch { /* ignore */ }

// Attach Authorization bearer (if available) and CSRF token for state-changing requests
api.interceptors.request.use(async (config) => {
    const method = (config.method || "get").toLowerCase();
    try {
        const token = typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null;
        if (token) {
            config.headers["Authorization"] = `Bearer ${token}`;
        }
    } catch { /* ignore */ }
    if (["post", "put", "patch", "delete"].includes(method)) {
        const token = readCookieToken() || latestCsrfToken || (await primeAndGetCsrfToken());
        if (token) {
            config.headers["X-CSRF-Token"] = token;
            config.headers["X-XSRF-Token"] = token;
        }
    }
    return config;
});

// Capture header token and retry once on CSRF failures
api.interceptors.response.use(
    (response) => {
        try {
            const headerToken = response?.headers?.["x-csrf-token"] || response?.headers?.["X-CSRF-Token"];
            if (headerToken) latestCsrfToken = headerToken;
        } catch { /* ignore */ }
        return response;
    },
    async (error) => {
        const response = error?.response;
        const originalConfig = error?.config;
        if (!response || !originalConfig) return Promise.reject(error);

        const isCsrfError =
            response.status === 403 &&
            (response.data?.message === "Invalid or missing CSRF token" ||
                response.data?.message === "CSRF validation failed");

        if (isCsrfError && !originalConfig.__retriedAfterCsrf) {
            try {
                await primeAndGetCsrfToken();
            } catch { /* ignore */ }
            const csrfToken = readCookieToken() || latestCsrfToken;
            originalConfig.__retriedAfterCsrf = true;
            if (csrfToken) {
                originalConfig.headers = originalConfig.headers || {};
                originalConfig.headers["X-CSRF-Token"] = csrfToken;
                originalConfig.headers["X-XSRF-Token"] = csrfToken;
            }
            return api.request(originalConfig);
        }
        return Promise.reject(error);
    }
);

export default api;
