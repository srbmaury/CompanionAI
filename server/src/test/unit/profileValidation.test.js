import { describe, expect, it } from "vitest";
import { ResetPasswordSchema, UpdateProfileSchema } from "../../validation/authSchemas.js";

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

    it("rejects weak passwords in the profile change flow", () => {
        expect(UpdateProfileSchema.safeParse({ currentPassword: "Old@Password1", newPassword: "123456" }).success).toBe(false);
    });

    it("rejects weak passwords in the forgot-password reset flow", () => {
        expect(ResetPasswordSchema.safeParse({ token: "reset-token", email: "user@example.com", newPassword: "123456" }).success).toBe(false);
    });

    it("accepts strong passwords in both password-change flows", () => {
        const strong = "New@Password1";
        expect(UpdateProfileSchema.safeParse({ currentPassword: "Old@Password1", newPassword: strong }).success).toBe(true);
        expect(ResetPasswordSchema.safeParse({ token: "reset-token", email: "user@example.com", newPassword: strong }).success).toBe(true);
    });
});
