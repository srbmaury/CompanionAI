import fetch from "node-fetch";

const BREVO_API_URL = "https://api.brevo.com/v3";
const envTrim = (value) => typeof value === "string" ? value.trim() : value;

const brevoRequest = async (path, options = {}) => {
    const apiKey = envTrim(process.env.BREVO_API_KEY);
    if (!apiKey) throw new Error("BREVO_API_KEY is not configured");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(`${BREVO_API_URL}${path}`, {
            ...options,
            signal: controller.signal,
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "api-key": apiKey,
                ...(options.headers || {}),
            },
        });
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(`Brevo API ${response.status}: ${body?.message || "request failed"}`);
        }
        return response.status === 204 ? {} : response.json();
    } finally {
        clearTimeout(timeout);
    }
};

const recipients = (to) => (Array.isArray(to) ? to : String(to || "").split(","))
    .map((email) => typeof email === "string" ? { email: email.trim() } : email)
    .filter((recipient) => recipient?.email);

export const sendMail = async ({ to, subject, html, text }) => {
    if (process.env.NODE_ENV === "test" && process.env.ALLOW_TEST_EMAIL !== "true") return;
    const senderEmail = envTrim(process.env.BREVO_SENDER_EMAIL);
    if (!senderEmail) throw new Error("BREVO_SENDER_EMAIL is not configured");
    return brevoRequest("/smtp/email", {
        method: "POST",
        body: JSON.stringify({
            sender: { email: senderEmail, name: envTrim(process.env.BREVO_SENDER_NAME) || "Evalcue AI" },
            to: recipients(to),
            subject,
            ...(html ? { htmlContent: html } : {}),
            ...(text ? { textContent: text } : {}),
            replyTo: { email: senderEmail, name: envTrim(process.env.BREVO_SENDER_NAME) || "Evalcue AI" },
            tags: ["companionai-transactional"],
        }),
    });
};

export const verifyEmailProvider = async () => {
    await brevoRequest("/account", { method: "GET" });
    console.log("Brevo API verified: transactional email ready");
};

export const buildVerificationEmail = (name, verifyUrl) => {
    const subject = "Verify your email";
    const text = `Hi ${name},\n\nPlease verify your email by clicking the link below:\n${verifyUrl}\n\nIf you did not sign up, you can ignore this email.`;
    const html = `
        <div style="font-family: Arial, sans-serif; line-height:1.5;">
            <h2>Verify your email</h2>
            <p>Hi ${name},</p>
            <p>Please verify your email by clicking the button below:</p>
            <p><a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;">Verify Email</a></p>
            <p>Or open this link: <br/><a href="${verifyUrl}">${verifyUrl}</a></p>
            <p>If you did not sign up, you can ignore this email.</p>
        </div>`;
    return { subject, text, html };
};
