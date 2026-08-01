import { describe, expect, it } from "vitest";
import { createJobId } from "../../queues/jobIds.js";

describe("createJobId", () => {
    it("creates stable BullMQ-compatible IDs without colons", () => {
        const input = { userId: "user", interviewId: "interview", roundId: "round", count: 8 };
        const first = createJobId("prepare", input);
        const second = createJobId("prepare", input);

        expect(first).toBe(second);
        expect(first).toMatch(/^prepare-[a-f0-9]{64}$/);
        expect(first).not.toContain(":");
    });

    it("changes when the job payload changes", () => {
        expect(createJobId("prepare", { count: 8 })).not.toBe(createJobId("prepare", { count: 9 }));
    });
});
