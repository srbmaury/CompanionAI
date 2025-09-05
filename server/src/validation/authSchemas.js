import { z } from "zod";

const emailSchema = z.string().trim().email();

const strongPassword = z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long")
    .refine((v) => /[a-z]/.test(v), { message: "Must include a lowercase letter" })
    .refine((v) => /[A-Z]/.test(v), { message: "Must include an uppercase letter" })
    .refine((v) => /\d/.test(v), { message: "Must include a digit" })
    .refine((v) => /[^A-Za-z0-9]/.test(v), { message: "Must include a special character" });

export const RegisterSchema = z.object({
    name: z.string().trim().min(1).max(100),
    email: emailSchema,
    password: strongPassword,
});

export const LoginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1),
});

export const VerifyEmailSchema = z.object({
    token: z.string().min(1),
    email: emailSchema,
});

export const ResendVerificationSchema = z.object({
    email: emailSchema,
});

export const ForgotPasswordSchema = z.object({
    email: emailSchema,
});

export const ResetPasswordSchema = z.object({
    token: z.string().min(1),
    email: emailSchema,
    newPassword: strongPassword,
});

export const GoogleIdTokenSchema = z.object({
    idToken: z.string().min(1),
});

export const UpdateProfileSchema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    currentPassword: z.string().min(1).optional(),
    newPassword: strongPassword.optional(),
    preferredProgrammingLanguage: z.enum(["javascript", "python", "cpp", "java"]).optional(),
}).refine((data) => {
    if (data.newPassword && !data.currentPassword) return false;
    return true;
}, { message: "currentPassword is required when changing password", path: ["currentPassword"] });