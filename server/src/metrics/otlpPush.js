import fetch from "node-fetch";
import metrics from "./index.js";

const WHITELIST = new Set([
    "http_requests_total",
    "errors_total",
    "csrf_denied_total",
    "origin_denied_total",
    "auth_login_attempts_total",
    "auth_register_total",
    "auth_verify_total",
    "auth_reset_total",
    "auth_logout_total",
    "security_password_change_total",
    "upload_resume_total",
    "stt_transcribe_total",
    "run_code_total",
    "tokens_rotated_total",
    "sessions_revoked_total",
]);

const toOtelAttributes = (labelsObj) => {
    return Object.entries(labelsObj || {}).map(([key, value]) => ({
        key: String(key),
        value: { stringValue: String(value) },
    }));
};

const buildOtlpPayload = async (serviceName) => {
    const nowNs = BigInt(Date.now()) * 1000000n;
    const json = await metrics.client.register.getMetricsAsJSON();

    const scopeMetrics = [{
        scope: { name: "companionai.prom-client" },
        metrics: [],
    }];

    for (const m of json) {
        if (!WHITELIST.has(m.name)) continue;
        if (m.type === "counter" || m.type === "gauge") {
            const dataPoints = (m.values || []).map((v) => ({
                timeUnixNano: Number(nowNs),
                attributes: toOtelAttributes(v.labels || {}),
                asDouble: Number(v.value),
            }));
            const metric = {
                name: m.name,
                unit: "1",
                description: m.help || "",
                // Counters are monotonic sums, gauges map to gauge
                ...(m.type === "counter"
                    ? { sum: { dataPoints, isMonotonic: true, aggregationTemporality: 2 } }
                    : { gauge: { dataPoints } }),
            };
            scopeMetrics[0].metrics.push(metric);
        }
        // Histograms can be added later if needed
    }

    return {
        resourceMetrics: [{
            resource: {
                attributes: [
                    { key: "service.name", value: { stringValue: serviceName } },
                ],
            },
            scopeMetrics,
        }],
    };
};

export const startOtlpPush = () => {
    const instanceId = process.env.GRAFANA_INSTANCE_ID;
    const apiKey = process.env.GRAFANA_API_KEY;
    if (!instanceId || !apiKey) return; // disabled
    const url = process.env.GRAFANA_OTLP_URL || "https://otlp-gateway-prod-ap-south-0.grafana.net/otlp/v1/metrics";
    const serviceName = process.env.OTEL_SERVICE_NAME || "companionai-server";
    const intervalMs = Number(process.env.OTLP_PUSH_INTERVAL_MS || 30000);

    const push = async () => {
        try {
            const payload = buildOtlpPayload(serviceName);
            const resp = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                // basic auth
                // node-fetch supports url with auth? We pass via fetch option 'headers' Authorization
                // Build manually:
                // Authorization: Basic base64(instanceId:apiKey)
                // Avoid logging secrets
                // eslint-disable-next-line no-undef
                redirect: "follow",
            });
            // If not using headers Authorization, use fetch with URL auth? We'll use basic header:
        } catch {}
    };

    // Implement with basic auth header
    const authHeader = "Basic " + Buffer.from(`${instanceId}:${apiKey}`).toString("base64");

    const pushWithAuth = async () => {
        try {
            const payload = await buildOtlpPayload(serviceName);
            await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: authHeader },
                body: JSON.stringify(payload),
            });
        } catch (e) {
            try { console.warn("[OTLP] push failed:", e?.message || e); } catch {}
        }
    };

    // Initial push and interval
    pushWithAuth().catch(() => {});
    const timer = setInterval(pushWithAuth, intervalMs);
    timer.unref?.();
};

export default { startOtlpPush };
