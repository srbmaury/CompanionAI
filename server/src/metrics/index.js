import client from "prom-client";

// Default metrics
client.collectDefaultMetrics();

// HTTP
export const httpRequestsTotal = new client.Counter({
    name: "http_requests_total",
    help: "Total HTTP requests",
    labelNames: ["method", "route", "status"],
});

export const httpRequestDurationSeconds = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status"],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

// Security and errors
export const rateLimitHitsTotal = new client.Counter({ name: "rate_limit_hits_total", help: "Rate limit hits", labelNames: ["route"] });
export const csrfDeniedTotal = new client.Counter({ name: "csrf_denied_total", help: "CSRF denials", labelNames: ["route"] });
export const originDeniedTotal = new client.Counter({ name: "origin_denied_total", help: "Origin/Referer denials", labelNames: ["route"] });
export const errorsTotal = new client.Counter({ name: "errors_total", help: "Unhandled errors", labelNames: ["status", "route"] });

// Auth
export const authLoginAttemptsTotal = new client.Counter({
    name: "auth_login_attempts_total",
    help: "Login attempts",
    labelNames: ["provider", "outcome"], // provider: local|google; outcome: success|failure|blocked
});
export const authRegisterTotal = new client.Counter({ name: "auth_register_total", help: "Register attempts", labelNames: ["outcome"] });
export const authVerifyTotal = new client.Counter({ name: "auth_verify_total", help: "Email verify actions", labelNames: ["type", "outcome"] }); // type: verify|resend
export const authResetTotal = new client.Counter({ name: "auth_reset_total", help: "Password reset actions", labelNames: ["action", "outcome"] }); // action: forgot|reset
export const authLogoutTotal = new client.Counter({ name: "auth_logout_total", help: "Logout count" });
export const securityPasswordChangeTotal = new client.Counter({ name: "security_password_change_total", help: "Password changes", labelNames: ["outcome"] });

// Features
export const uploadResumeTotal = new client.Counter({ name: "upload_resume_total", help: "Resume uploads", labelNames: ["outcome"] });
export const sttTranscribeTotal = new client.Counter({ name: "stt_transcribe_total", help: "STT transcriptions", labelNames: ["outcome"] });
export const runCodeTotal = new client.Counter({ name: "run_code_total", help: "Code executions", labelNames: ["language", "outcome", "errorType"] });
export const quotasDeniedTotal = new client.Counter({ name: "quotas_denied_total", help: "Per-user quota denials", labelNames: ["actionKey"] });

// Tokens / sessions
export const tokensRotatedTotal = new client.Counter({ name: "tokens_rotated_total", help: "Refresh tokens rotated" });
export const sessionsRevokedTotal = new client.Counter({ name: "sessions_revoked_total", help: "Sessions revoked", labelNames: ["scope"] }); // scope: one|all

export default {
    client,
    httpRequestsTotal,
    httpRequestDurationSeconds,
    rateLimitHitsTotal,
    csrfDeniedTotal,
    originDeniedTotal,
    errorsTotal,
    authLoginAttemptsTotal,
    authRegisterTotal,
    authVerifyTotal,
    authResetTotal,
    authLogoutTotal,
    securityPasswordChangeTotal,
    uploadResumeTotal,
    sttTranscribeTotal,
    runCodeTotal,
    quotasDeniedTotal,
    tokensRotatedTotal,
    sessionsRevokedTotal,
};
