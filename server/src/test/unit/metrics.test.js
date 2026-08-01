import { describe, expect, it } from "vitest";
import client from "prom-client";
import { normalizeRoute } from "../../metrics/routes.js";
import { buildOtlpPayload } from "../../metrics/otlpPush.js";

describe("observability metrics", () => {
    it("normalizes unmatched dynamic identifiers without retaining sensitive cardinality", () => {
        expect(normalizeRoute({ path: "/api/jobs/prepare-questions/507f1f77bcf86cd799439011" })).toBe("unmatched_api");
        expect(normalizeRoute({ route: { path: "/:id" }, originalUrl: "/api/resumes/507f1f77bcf86cd799439011" })).toBe("/api/resumes/:id");
        expect(normalizeRoute({ route: { path: "/status/:queue/:id" }, originalUrl: "/api/jobs/status/prepare-questions/job-id" })).toBe("/api/jobs/status/:queue/:id");
        expect(normalizeRoute({ path: "/health/readiness" })).toBe("/health/readiness");
    });

    it("exports cumulative Prometheus histograms as OTLP explicit histograms", async () => {
        const registry = new client.Registry();
        const histogram = new client.Histogram({ name: "test_duration_seconds", help: "test", buckets: [1, 2], labelNames: ["route"], registers: [registry] });
        histogram.labels("/safe/:id").observe(0.5);
        histogram.labels("/safe/:id").observe(3);
        const payload = await buildOtlpPayload("test-service", registry);
        const metric = payload.resourceMetrics[0].scopeMetrics[0].metrics[0];
        expect(metric.histogram.dataPoints[0]).toMatchObject({ count: "2", explicitBounds: [1, 2], bucketCounts: ["1", "0", "1"] });
        expect(typeof metric.histogram.dataPoints[0].timeUnixNano).toBe("string");
    });
});
