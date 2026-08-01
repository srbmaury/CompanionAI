import axios from "axios";

export const resolveApiBaseUrl = (envUrl, hostname) => {
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    if (isLocal) {
        if (!envUrl || envUrl.startsWith("/")) return "/api";
        try {
            const configuredHost = new URL(envUrl).hostname;
            if (["localhost", "127.0.0.1", "::1"].includes(configuredHost)) return "/api";
        } catch { /* use the configured value below */ }
    }
    return envUrl || "/api";
};

const resolveBaseUrl = () => resolveApiBaseUrl(
    import.meta?.env?.VITE_API_BASE_URL,
    typeof window !== "undefined" ? window.location.hostname : "",
);

const api = axios.create({
    baseURL: resolveBaseUrl(),
    withCredentials: true,
});

let accessToken = null;
export const setAccessToken = (token) => { accessToken = token || null; };
export const clearAccessToken = () => { accessToken = null; };

// Attach Authorization bearer token on every request
api.interceptors.request.use((config) => {
    try {
        if (accessToken) config.headers["Authorization"] = `Bearer ${accessToken}`;
    } catch { /* ignore */ }
    return config;
});

let refreshPromise = null;

export const silentRefresh = async () => {
    if (!refreshPromise) {
        refreshPromise = axios
            .post(`${resolveBaseUrl()}/auth/refresh`, {}, { withCredentials: true })
            .then((res) => {
                const token = res?.data?.token;
                if (token) setAccessToken(token);
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
                clearAccessToken();
                if (!window.location.pathname.startsWith("/login")) {
                    window.location.href = "/login";
                }
            } catch { /* ignore */ }
        }

        return Promise.reject(error);
    }
);

export default api;
