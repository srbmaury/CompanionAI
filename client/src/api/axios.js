import axios from "axios";

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

// Attach Authorization bearer token on every request
api.interceptors.request.use((config) => {
    try {
        const token = typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null;
        if (token) config.headers["Authorization"] = `Bearer ${token}`;
    } catch { /* ignore */ }
    return config;
});

let refreshPromise = null;

const silentRefresh = async () => {
    if (!refreshPromise) {
        refreshPromise = axios
            .post(`${resolveBaseUrl()}/auth/refresh`, {}, { withCredentials: true })
            .then((res) => {
                const token = res?.data?.token;
                if (token) {
                    try { window.localStorage.setItem("accessToken", token); } catch { /* ignore */ }
                }
                return token;
            })
            .finally(() => { refreshPromise = null; });
    }
    return refreshPromise;
};

// On 401: try silent refresh once, then redirect to login
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error?.response?.status;
        const originalConfig = error?.config;

        if (status === 401 && originalConfig && !originalConfig.__retried) {
            originalConfig.__retried = true;
            try {
                const newToken = await silentRefresh();
                if (newToken) {
                    originalConfig.headers["Authorization"] = `Bearer ${newToken}`;
                    return api.request(originalConfig);
                }
            } catch { /* refresh failed — fall through to logout */ }

            try {
                window.localStorage.removeItem("accessToken");
                if (!window.location.pathname.startsWith("/login")) {
                    window.location.href = "/login";
                }
            } catch { /* ignore */ }
        }

        return Promise.reject(error);
    }
);

export default api;
