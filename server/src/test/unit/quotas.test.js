import { beforeEach, describe, expect, it, vi } from "vitest";

const { incr, expire, inc, labels } = vi.hoisted(() => {
    const metricInc = vi.fn();
    return { incr: vi.fn(), expire: vi.fn(), inc: metricInc, labels: vi.fn(() => ({ inc: metricInc })) };
});

vi.mock("../../config/redis.js", () => ({ default: vi.fn(async () => ({ incr, expire })) }));
vi.mock("../../metrics/index.js", () => ({ default: { quotasDeniedTotal: { labels } } }));

import quotas from "../../middleware/quotas.js";

describe("quota metrics", () => {
    beforeEach(() => { vi.clearAllMocks(); incr.mockResolvedValue(2); expire.mockResolvedValue(true); });

    it("uses a bounded metric action instead of the identifier-bearing Redis key", async () => {
        const middleware = quotas({
            key: () => "assessment-answer:attempt-secret-123:203.0.113.1",
            metricKey: "assessment_answer",
            windowSeconds: 60,
            maxPerWindow: 1,
        });
        const status = vi.fn().mockReturnThis();
        const json = vi.fn().mockReturnThis();
        await middleware({ ip: "203.0.113.1" }, { status, json }, vi.fn());
        expect(status).toHaveBeenCalledWith(429);
        expect(labels).toHaveBeenCalledWith("assessment_answer");
        expect(labels).not.toHaveBeenCalledWith(expect.stringContaining("attempt-secret"));
        expect(inc).toHaveBeenCalledOnce();
    });
});
