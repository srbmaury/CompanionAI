import fetch from "node-fetch";

const verifyTurnstile = async (token, ip) => {
    const secret = process.env.CAPTCHA_SECRET;
    if (!secret) return false;
    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token, remoteip: ip || "" }),
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    return !!data?.success;
};

const verifyRecaptcha = async (token, ip) => {
    const secret = process.env.CAPTCHA_SECRET;
    if (!secret) return false;
    const resp = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token, remoteip: ip || "" }),
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    return !!data?.success;
};

const captcha = () => {
    return async (req, res, next) => {
        try {
            if (process.env.NODE_ENV !== "production") return next();
            if (process.env.CAPTCHA_ENABLED !== "true") return next();
            const token = req.body?.captchaToken || req.get("x-captcha-token");
            if (!token) return res.status(400).json({ message: "Missing CAPTCHA token" });
            const provider = (process.env.CAPTCHA_PROVIDER || "turnstile").toLowerCase();
            const ip = req.ip;
            let ok = false;
            if (provider === "turnstile") ok = await verifyTurnstile(token, ip);
            else if (provider === "recaptcha") ok = await verifyRecaptcha(token, ip);
            if (!ok) return res.status(400).json({ message: "CAPTCHA verification failed" });
            return next();
        } catch (e) {
            return res.status(400).json({ message: "CAPTCHA verification error" });
        }
    };
};

export default captcha;