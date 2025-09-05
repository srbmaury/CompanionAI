import nodemailer from "nodemailer";

// Support env names like the MERN-Chat-App example
const envTrim = (v) => (typeof v === "string" ? v.trim() : v);

// Lazy transporter to ensure env is loaded (dotenv) before reading
let transporter = null;
const getTransporter = () => {
    if (transporter) return transporter;
    const smtpUser = envTrim(process.env.SMTP_USER);
    const smtpPassRaw = envTrim(process.env.SMTP_PASS);
    const smtpPass = typeof smtpPassRaw === "string" ? smtpPassRaw.replace(/\s+/g, "") : smtpPassRaw;
    const smtpHost = envTrim(process.env.SMTP_HOST);
    const smtpPort = Number(envTrim(process.env.SMTP_PORT) || 587);
    if (!smtpHost) {
        console.warn("SMTP_HOST not set. Set SMTP_HOST (e.g., smtp.mailtrap.io)");
    }
    if (!smtpUser || !smtpPass) {
        console.warn("SMTP_USER/SMTP_PASS not set. Set both to enable email sending.");
    }
    transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        requireTLS: smtpPort === 587,
        auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
        logger: process.env.NODE_ENV !== "production",
    });
    return transporter;
};

export const sendMail = async ({ to, subject, html, text }) => {
    const from = envTrim(process.env.MAIL_FROM) || envTrim(process.env.SMTP_USER);
    await getTransporter().sendMail({
        from,
        to,
        subject,
        html,
        text,
        envelope: { from: from, to: to },
    });
};

export const buildVerificationEmail = (name, verifyUrl) => {
    const subject = "Verify your email";
    const text = `Hi ${name},\n\nPlease verify your email by clicking the link below:\n${verifyUrl}\n\nIf you did not sign up, you can ignore this email.`;
    const html = `
        <div style="font-family: Arial, sans-serif; line-height:1.5;">
            <h2>Verify your email</h2>
            <p>Hi ${name},</p>
            <p>Please verify your email by clicking the button below:</p>
            <p>
                <a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;">Verify Email</a>
            </p>
            <p>Or open this link: <br/><a href="${verifyUrl}">${verifyUrl}</a></p>
            <p>If you did not sign up, you can ignore this email.</p>
        </div>
    `;
    return { subject, text, html };
};

// No default export to avoid initializing transporter at import time

export const verifySmtp = async () => {
    try {
        await getTransporter().verify();
        console.log("SMTP verified: connection ready");
    } catch (e) {
        console.warn("SMTP verify failed:", e?.message || e);
        throw e;
    }
};
