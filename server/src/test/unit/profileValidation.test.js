import { describe, expect, it } from "vitest";
import { UpdateProfileSchema } from "../../validation/authSchemas.js";

describe("profile reminder validation", () => {
    it("accepts an IANA timezone", () => {
        const result = UpdateProfileSchema.safeParse({ reminderTimezone: "Asia/Kolkata" });
        expect(result.success).toBe(true);
    });

    it("rejects arbitrary timezone text", () => {
        const result = UpdateProfileSchema.safeParse({ reminderTimezone: "sadfg" });
        expect(result.success).toBe(false);
        expect(result.error.issues.some((issue) => issue.message === "Invalid timezone")).toBe(true);
    });
});
