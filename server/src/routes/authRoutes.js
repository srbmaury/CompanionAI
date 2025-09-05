import express from "express";
import {
    registerUser,
    loginUser,
    logoutUser,
    verifyEmail,
    resendVerification,
    googleSignIn,
    updateProfile,
    forgotPassword,
    resetPassword,
} from "../controllers/authController.js";
import { listSessions, revokeSession, revokeAllSessions } from "../controllers/sessionController.js";
import protect from "../middleware/authMiddleware.js";
import {
    loginLimiter,
    registerLimiter,
    forgotPasswordLimiter,
    resetPasswordLimiter,
    verifyEmailLimiter,
    resendVerificationLimiter,
    googleLoginLimiter,
} from "../middleware/rateLimiters.js";
import validate from "../middleware/validate.js";
import {
    RegisterSchema,
    LoginSchema,
    VerifyEmailSchema,
    ResendVerificationSchema,
    ForgotPasswordSchema,
    ResetPasswordSchema,
    GoogleIdTokenSchema,
    UpdateProfileSchema,
} from "../validation/authSchemas.js";
import { loginAttemptCheck } from "../middleware/loginLockout.js";
import captcha from "../middleware/captcha.js";

// Only require CAPTCHA on login when explicitly enabled
const loginCaptcha = (req, res, next) => {
    if ((process.env.CAPTCHA_LOGIN_ENABLED || "").toLowerCase() === "true") {
        return captcha()(req, res, next);
    }
    return next();
};

// Only require CAPTCHA on register when explicitly enabled (default off until widget is wired)
const registerCaptcha = (req, res, next) => {
    if ((process.env.CAPTCHA_REGISTER_ENABLED || "false").toLowerCase() === "true") {
        return captcha()(req, res, next);
    }
    return next();
};

const router = express.Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       201:
 *         description: User registered
 *
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Logged in successfully; jwt cookie set
 *       401:
 *         description: Invalid credentials
 *
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout current user
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logged out
 *       401:
 *         description: Not authorized
 *
 * /api/auth/profile:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user profile
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *       401:
 *         description: Not authorized
 *
 *   put:
 *     tags: [Auth]
 *     summary: Update current user profile (name and/or password)
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Profile updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authorized
 *
 * /api/auth/verify-email:
 *   post:
 *     tags: [Auth]
 *     summary: Verify email with token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, email]
 *             properties:
 *               token:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Email verified
 *       400:
 *         description: Invalid or expired token
 *
 * /api/auth/resend-verification:
 *   post:
 *     tags: [Auth]
 *     summary: Resend verification email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Verification email sent
 *
 * /api/auth/google:
 *   post:
 *     tags: [Auth]
 *     summary: Google Sign-In using ID token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logged in successfully; jwt cookie set
 *       401:
 *         description: Invalid Google token
 *
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Send a password reset link if the account exists and is verified
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: If the email exists, a reset link has been sent
 *
 * /api/auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using token sent via email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, email, newPassword]
 *             properties:
 *               token:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               newPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password has been reset
 *       400:
 *         description: Invalid or expired token
 */

// Public
router.post("/register", registerLimiter, registerCaptcha, validate(RegisterSchema), registerUser);
router.post("/login", loginLimiter, loginAttemptCheck, loginCaptcha, validate(LoginSchema), loginUser);
router.post("/verify-email", verifyEmailLimiter, validate(VerifyEmailSchema), verifyEmail);
router.post("/resend-verification", resendVerificationLimiter, validate(ResendVerificationSchema), resendVerification);
router.post("/google", googleLoginLimiter, validate(GoogleIdTokenSchema), googleSignIn);
router.post("/forgot-password", forgotPasswordLimiter, captcha(), validate(ForgotPasswordSchema), forgotPassword);
router.post("/reset-password", resetPasswordLimiter, captcha(), validate(ResetPasswordSchema), resetPassword);

// Protected
router.post("/logout", protect, logoutUser);
router.get("/profile", protect, (req, res) => {
    res.json(req.user);
});
router.put("/profile", protect, validate(UpdateProfileSchema), updateProfile);

// Sessions management
router.get("/sessions", protect, listSessions);
router.delete("/sessions", protect, revokeAllSessions);
router.delete("/sessions/:id", protect, revokeSession);

export default router;
