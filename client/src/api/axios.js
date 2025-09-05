import axios from "axios";

const api = axios.create({
    baseURL: import.meta?.env?.VITE_API_BASE_URL || "/api",
    withCredentials: true,
});

// Prime CSRF cookie early (non-blocking). Any GET under /api will set it.
try {
    api.get(`/auth/profile`).catch(() => { /* ignore */ }); // 401 is fine; seeds CSRF cookie
} catch { /* ignore */ }

// Attach CSRF token from cookie to header for state-changing requests
api.interceptors.request.use((config) => {
    const method = (config.method || "get").toLowerCase();
    if (["post", "put", "patch", "delete"].includes(method)) {
        const match = document.cookie.match(/(?:^|; )csrfToken=([^;]+)/);
        const csrfToken = match ? decodeURIComponent(match[1]) : null;
        if (csrfToken) {
            config.headers["X-CSRF-Token"] = csrfToken;
        }
    }
    return config;
});

// If a request fails due to missing/invalid CSRF, fetch a fresh token and retry once
api.interceptors.response.use(
    (response) => response,
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
                // GET to seed CSRF cookie (401 is expected without auth)
                await api.get(`/auth/profile`);
            } catch { /* ignore */ }

            // Re-apply latest CSRF token and retry once
            const match = document.cookie.match(/(?:^|; )csrfToken=([^;]+)/);
            const csrfToken = match ? decodeURIComponent(match[1]) : null;
            originalConfig.__retriedAfterCsrf = true;
            if (csrfToken) {
                originalConfig.headers = originalConfig.headers || {};
                originalConfig.headers["X-CSRF-Token"] = csrfToken;
            }
            return api.request(originalConfig);
        }
        return Promise.reject(error);
    }
);

export default api;
