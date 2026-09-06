import fetch from "node-fetch";
import metrics from "./index.js";

const toOtelAttributes = (labels = {}) => Object.entries(labels).map(([key, value]) => ({
    key: String(key),
    value: { stringValue: String(value) },
}));

const labelsKey = (labels = {}) => JSON.stringify(Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)));

const histogramDataPoints = (metric, nowNs) => {
    const groups = new Map();
    for (const value of metric.values || []) {
        const labels = { ...(value.labels || {}) };
        delete labels.le;
        const key = labelsKey(labels);
        if (!groups.has(key)) groups.set(key, { labels, buckets: [], sum: 0, count: 0 });
        const group = groups.get(key);
        if (value.metricName === `${metric.name}_sum`) group.sum = Number(value.value);
        else if (value.metricName === `${metric.name}_count`) group.count = Number(value.value);
        else if (value.metricName === `${metric.name}_bucket`) group.buckets.push({ upper: value.labels?.le, cumulative: Number(value.value) });
    }
    return [...groups.values()].map((group) => {
        const finite = group.buckets.filter((b) => b.upper !== "+Inf").sort((a, b) => Number(a.upper) - Number(b.upper));
        const infinity = group.buckets.find((b) => b.upper === "+Inf");
        let previous = 0;
        const bucketCounts = finite.map((bucket) => {
            const count = Math.max(0, bucket.cumulative - previous);
            previous = bucket.cumulative;
            return String(count);
        });
        bucketCounts.push(String(Math.max(0, (infinity?.cumulative ?? group.count) - previous)));
        return {
            timeUnixNano: nowNs,
            attributes: toOtelAttributes(group.labels),
            count: String(group.count),
            sum: group.sum,
            explicitBounds: finite.map((bucket) => Number(bucket.upper)),
            bucketCounts,
        };
    });
};

export const buildOtlpPayload = async (serviceName, registry = metrics.client.register) => {
    const nowNs = (BigInt(Date.now()) * 1000000n).toString();
    const json = await registry.getMetricsAsJSON();
    const exported = [];

    for (const metric of json) {
        if (metric.type === "counter" || metric.type === "gauge") {
            const dataPoints = (metric.values || []).map((value) => ({
                timeUnixNano: nowNs,
                attributes: toOtelAttributes(value.labels || {}),
                asDouble: Number(value.value),
            }));
            exported.push({
                name: metric.name,
                unit: "1",
                description: metric.help || "",
                ...(metric.type === "counter"
                    ? { sum: { dataPoints, isMonotonic: true, aggregationTemporality: 2 } }
                    : { gauge: { dataPoints } }),
            });
        } else if (metric.type === "histogram") {
            exported.push({
                name: metric.name,
                unit: metric.name.endsWith("_seconds") ? "s" : metric.name.endsWith("_bytes") ? "By" : "1",
                description: metric.help || "",
                histogram: { dataPoints: histogramDataPoints(metric, nowNs), aggregationTemporality: 2 },
            });
        }
    }

    return { resourceMetrics: [{ resource: { attributes: [{ key: "service.name", value: { stringValue: serviceName } }] }, scopeMetrics: [{ scope: { name: "evalcue.prom-client" }, metrics: exported }] }] };
};

export const startOtlpPush = () => {
    const instanceId = process.env.GRAFANA_INSTANCE_ID;
    const apiKey = process.env.GRAFANA_API_KEY;
    if (!instanceId || !apiKey) return () => {};
    const url = process.env.GRAFANA_OTLP_URL || "https://otlp-gateway-prod-ap-south-0.grafana.net/otlp/v1/metrics";
    const serviceName = process.env.OTEL_SERVICE_NAME || "evalcue-server";
    const intervalMs = Math.max(Number(process.env.OTLP_PUSH_INTERVAL_MS || 30000), 10000);
    const authHeader = `Basic ${Buffer.from(`${instanceId}:${apiKey}`).toString("base64")}`;
    const push = async () => {
        try {
            const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader }, body: JSON.stringify(await buildOtlpPayload(serviceName)) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
        } catch (error) {
            console.warn("[OTLP] push failed:", error?.message || error);
        }
    };
    push();
    const timer = setInterval(push, intervalMs);
    timer.unref?.();
    return () => clearInterval(timer);
};

export default { startOtlpPush, buildOtlpPayload };
