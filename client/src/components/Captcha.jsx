import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Lightweight, dependency-free CAPTCHA wrapper for Turnstile or reCAPTCHA v2 checkbox
// Props:
// - onVerify(token: string)
// - onExpire?()
// - provider?: "turnstile" | "recaptcha" (defaults from env)
// - theme?: "auto" | "light" | "dark"

const loadScript = (src) =>
    new Promise((resolve, reject) => {
        try {
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                if (existing.getAttribute("data-loaded") === "true") return resolve();
                existing.addEventListener("load", () => resolve());
                existing.addEventListener("error", (e) => reject(e));
                return;
            }
            const s = document.createElement("script");
            s.src = src;
            s.async = true;
            s.defer = true;
            s.addEventListener("load", () => {
                s.setAttribute("data-loaded", "true");
                resolve();
            });
            s.addEventListener("error", (e) => reject(e));
            document.head.appendChild(s);
        } catch (e) {
            reject(e);
        }
    });

const Captcha = ({ onVerify, onExpire, provider, theme = "auto" }) => {
    const containerRef = useRef(null);
    const widgetIdRef = useRef(null);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState("");

    // Keep latest callbacks without retriggering init
    const onVerifyRef = useRef(onVerify);
    const onExpireRef = useRef(onExpire);
    useEffect(() => { onVerifyRef.current = onVerify; }, [onVerify]);
    useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);

    const cfg = useMemo(() => {
        const p = (provider || (import.meta.env.VITE_CAPTCHA_PROVIDER || "turnstile")).toLowerCase();
        return {
            provider: p === "recaptcha" ? "recaptcha" : "turnstile",
            turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY || "",
            recaptchaSiteKey: import.meta.env.VITE_RECAPTCHA_SITE_KEY || "",
        };
    }, [provider]);

    const reset = useCallback(() => {
        try {
            if (cfg.provider === "turnstile" && window.turnstile && widgetIdRef.current) {
                window.turnstile.reset(widgetIdRef.current);
            }
            if (cfg.provider === "recaptcha" && window.grecaptcha && widgetIdRef.current !== null) {
                window.grecaptcha.reset(widgetIdRef.current);
            }
        } catch { /* CAPTCHA reset is best-effort. */ }
    }, [cfg.provider]);

    useEffect(() => {
        let cancelled = false;
        const init = async () => {
            try {
                setError("");
                // Prevent duplicate widget renders (StrictMode/double effects)
                if (widgetIdRef.current) return;
                if (cfg.provider === "turnstile") {
                    if (!cfg.turnstileSiteKey) throw new Error("Missing VITE_TURNSTILE_SITE_KEY");
                    await loadScript("https://challenges.cloudflare.com/turnstile/v0/api.js");
                    if (cancelled) return;
                    if (!window.turnstile || !containerRef.current) return;
                    // Ensure empty container before render
                    containerRef.current.innerHTML = "";
                    const id = window.turnstile.render(containerRef.current, {
                        sitekey: cfg.turnstileSiteKey,
                        theme,
                        callback: (token) => {
                            try { onVerifyRef.current?.(token); } catch { /* Consumer callback errors must not break the widget. */ }
                        },
                        "expired-callback": () => {
                            try { onExpireRef.current?.(); } catch { /* Consumer callback errors must not break the widget. */ }
                        },
                        "error-callback": () => {
                            setError("CAPTCHA failed to load. Try again.");
                        },
                    });
                    widgetIdRef.current = id;
                    setReady(true);
                    return;
                }

                // reCAPTCHA v2 checkbox
                if (!cfg.recaptchaSiteKey) throw new Error("Missing VITE_RECAPTCHA_SITE_KEY");
                await loadScript("https://www.google.com/recaptcha/api.js?render=explicit");
                if (cancelled) return;
                if (!window.grecaptcha || !containerRef.current) return;
                window.grecaptcha.ready(() => {
                    try {
                        // Ensure empty container before render
                        containerRef.current.innerHTML = "";
                        const id = window.grecaptcha.render(containerRef.current, {
                            sitekey: cfg.recaptchaSiteKey,
                            theme: theme === "auto" ? "light" : theme,
                            callback: (token) => {
                                try { onVerifyRef.current?.(token); } catch { /* Consumer callback errors must not break the widget. */ }
                            },
                            "expired-callback": () => {
                                try { onExpireRef.current?.(); } catch { /* Consumer callback errors must not break the widget. */ }
                            },
                            "error-callback": () => setError("CAPTCHA failed to load. Try again."),
                        });
                        widgetIdRef.current = id;
                        setReady(true);
                    } catch {
                        setError("CAPTCHA failed to initialize.");
                    }
                });
            } catch (e) {
                setError(e?.message || "CAPTCHA error");
            }
        };
        init();
        const container = containerRef.current;
        return () => {
            cancelled = true;
            try {
                if (cfg.provider === "turnstile") {
                    if (window.turnstile && container) {
                        // Best-effort removal
                        window.turnstile.remove(container);
                    }
                } else if (cfg.provider === "recaptcha") {
                    if (window.grecaptcha && widgetIdRef.current !== null) {
                        // No official destroy API; reset and clear container
                        try { window.grecaptcha.reset(widgetIdRef.current); } catch { /* Widget may already be removed. */ }
                        if (container) container.innerHTML = "";
                    }
                }
            } catch { /* Cleanup is best-effort. */ }
            widgetIdRef.current = null;
        };
    }, [cfg.provider, cfg.turnstileSiteKey, cfg.recaptchaSiteKey, theme]);

    return (
        <div>
            <div ref={containerRef} data-ready={ready ? "1" : "0"} />
            {error ? (
                <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 6 }}>{error}</div>
            ) : null}
            {/* Expose a minimal API via DOM for testing if needed */}
            <input type="hidden" data-captcha-widget-id={widgetIdRef.current || ""} />
            <button type="button" style={{ display: "none" }} onClick={reset} aria-hidden="true" />
        </div>
    );
};

export default Captcha;
