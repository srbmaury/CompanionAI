import crypto from "crypto";
import metrics from "../metrics/index.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const generateToken = () => crypto.randomBytes(32).toString("hex");

const csrf = () => {
    return (req, res, next) => {
        try {
            const isProd = process.env.NODE_ENV === "production";
            const enforce = isProd || process.env.CSRF_ENFORCE === "true";
            const isHttps = !!req.secure;
            const host = (req.hostname || "").toLowerCase();
            const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "::1" || /^(\d+\.){3}\d+$/.test(host);
            // Determine sameSite/secure compatibly with the actual transport
            let sameSite = isProd ? (process.env.CSRF_SAMESITE || "none").toLowerCase() : "lax";
            if (isProd && sameSite === "none" && !isHttps) {
                // Browsers drop SameSite=None without Secure; downgrade for non-HTTPS
                sameSite = "lax";
            }
            const envDomain = process.env.CSRF_COOKIE_DOMAIN || process.env.COOKIE_DOMAIN || undefined;
            const domain = isProd && !isLocalHost ? envDomain : undefined;
            const secure = isProd && isHttps; // Only secure over HTTPS

            // Ensure a CSRF token cookie exists for the client to read and echo back
            let csrfCookie = req.cookies?.csrfToken;
            if (!csrfCookie) {
                csrfCookie = generateToken();
                res.cookie("csrfToken", csrfCookie, {
                    httpOnly: false,
                    secure,
                    sameSite,
                    domain,
                    path: "/",
                });
            }

            if (SAFE_METHODS.has(req.method)) return next();
            if (!enforce) return next();

            // For state-changing requests, require matching header
            const headerToken = req.get("x-csrf-token") || req.get("x-xsrf-token");
            if (!headerToken || headerToken !== csrfCookie) {
                try { const route = req.route?.path || req.path; metrics.csrfDeniedTotal.labels(route).inc(); } catch {}
                return res.status(403).json({ message: "Invalid or missing CSRF token" });
            }
            return next();
        } catch (e) {
            try { const route = req.route?.path || req.path; metrics.csrfDeniedTotal.labels(route).inc(); } catch {}
            return res.status(403).json({ message: "CSRF validation failed" });
        }
    };
};

export default csrf;