import { beforeEach, describe, expect, it } from "vitest";
import client from "prom-client";
import productionMetrics from "../../metrics/production.js";
import { buildOtlpPayload } from "../../metrics/otlpPush.js";

const resetProductionMetrics = () => {
    for (const metric of Object.values(productionMetrics)) metric.reset?.();
};

describe("production metrics", () => {
    beforeEach(() => {
        resetProductionMetrics();
    });

    it("registers the launch-critical queue, dependency, evaluation, and AI metrics", async () => {
        const names = new Set((await client.register.getMetricsAsJSON()).map((metric) => metric.name));
        for (const name of [
            "queue_wait_duration_seconds",
            "queue_oldest_waiting_job_age_seconds",
            "queue_jobs_in_flight",
            "assessment_evaluation_duration_seconds",
            "assessment_evaluations_in_flight",
            "mongo_pool_connections",
            "mongo_pool_wait_queue",
            "mongo_pool_checkout_failures_total",
            "redis_ping_duration_seconds",
            "redis_reconnects_total",
            "redis_connection_ready",
            "ai_tokens_by_purpose_total",
        ]) {
            expect(names.has(name), `${name} should be registered`).toBe(true);
        }
    });

    it("keeps production labels bounded and free of user or attempt identifiers", () => {
        expect(productionMetrics.queueWaitDurationSeconds.labelNames).toEqual(["queue"]);
        expect(productionMetrics.assessmentEvaluationDurationSeconds.labelNames).toEqual(["outcome"]);
        expect(productionMetrics.mongoPoolConnections.labelNames).toEqual(["state"]);
        expect(productionMetrics.aiTokensByPurposeTotal.labelNames).toEqual(["provider", "model", "purpose", "type"]);
    });

    it("exports the new metrics through the existing OTLP push path", async () => {
        productionMetrics.queueWaitDurationSeconds.labels("candidate-assessment").observe(2.5);
        productionMetrics.aiTokensByPurposeTotal.labels("openai", "test-model", "feedback_evaluation", "input").inc(100);

        const payload = await buildOtlpPayload("evalcue-test");
        const exported = payload.resourceMetrics[0].scopeMetrics[0].metrics.map((metric) => metric.name);
        expect(exported).toContain("queue_wait_duration_seconds");
        expect(exported).toContain("ai_tokens_by_purpose_total");
    });
});
