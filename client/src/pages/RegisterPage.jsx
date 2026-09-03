import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import Captcha from "../components/Captcha";
import AuthShell from "../components/AuthShell";

// MUI components
import {
    Box,
    Button,
    Checkbox,
    FormControl,
    FormControlLabel,
    FormHelperText,
    IconButton,
    InputAdornment,
    Link,
    Stack,
    TextField,
    Typography,
} from "@mui/material";

// Icons
import { PersonAddAlt1 as PersonAddIcon, Visibility, VisibilityOff } from "@mui/icons-material";

const RegisterPage = () => {
    const { register, googleLogin, resendVerification } = useContext(AuthContext);
    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [gsiReady, setGsiReady] = useState(false);
    const [submittedEmail, setSubmittedEmail] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    const googleDivRef = useRef(null);
    const [captchaToken, setCaptchaToken] = useState("");
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    // simple inline validation state
    const [errors, setErrors] = useState({ name: "", email: "", password: "" });

    const passwordPolicyError = (pwd) => {
        if (!pwd) return "Password is required";
        if (pwd.length < 8) return "Password must be at least 8 characters";
        if (!/[a-z]/.test(pwd)) return "Password must include a lowercase letter";
        if (!/[A-Z]/.test(pwd)) return "Password must include an uppercase letter";
        if (!/\d/.test(pwd)) return "Password must include a digit";
        if (!/[^A-Za-z0-9]/.test(pwd)) return "Password must include a special character";
        return "";
    };

    const validate = () => {
        const next = { name: "", email: "", password: "" };
        if (!name.trim()) next.name = "Name is required";
        if (!email) next.email = "Email is required";
        // basic pattern (optional): very light client-side hinting
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (email && !emailPattern.test(email))
            next.email = "Enter a valid email";
        const pwdErr = passwordPolicyError(password);
        if (pwdErr) next.password = pwdErr;
        setErrors(next);
        return !next.name && !next.email && !next.password;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate() || !acceptedTerms) return;

        setSubmitting(true);
        try {
            const resp = await register(name.trim(), email, password, captchaToken);
            setSubmittedEmail(email);
            setSuccessMsg(resp?.message || "Verification email sent. Please check your inbox.");
        } catch (err) {
            // Show friendly error inline
            const apiMsg = err?.response?.data?.message;
            const apiDetails = err?.response?.data?.details;
            let pwdError = "";
            if (Array.isArray(apiDetails)) {
                const pwdIssues = apiDetails.filter((d) => String(d?.path || "").includes("password"));
                if (pwdIssues.length > 0) {
                    pwdError = pwdIssues.map((d) => d?.message).filter(Boolean).join(". ");
                }
            }
            setErrors((prev) => ({
                ...prev,
                email: apiMsg === "User already exists" ? "Email already registered" : prev.email,
                password: pwdError || (apiMsg && apiMsg !== "User already exists" ? apiMsg : prev.password || "Could not register. Try again."),
            }));
        } finally {
            setSubmitting(false);
        }
    };

    // Detect GIS readiness
    useEffect(() => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
        if (!clientId) return;
        if (window.google && window.google.accounts && window.google.accounts.id) {
            setGsiReady(true);
            return;
        }
        let script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
        const onLoad = () => setGsiReady(true);
        if (!script) {
            script = document.createElement("script");
            script.src = "https://accounts.google.com/gsi/client";
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        }
        script.addEventListener("load", onLoad);
        return () => {
            if (script) script.removeEventListener("load", onLoad);
        };
    }, []);

    // Render button
    useEffect(() => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
        if (!acceptedTerms || !clientId || !gsiReady || !googleDivRef.current) return;
        try {
            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: async (response) => {
                    try {
                        await googleLogin(response.credential);
                        navigate(localStorage.getItem("companionai:workspace") === "hiring" ? "/assessments" : "/dashboard", { replace: true });
                    } catch {
                        setErrors((prev) => ({ ...prev, password: "Google sign-in failed" }));
                    }
                },
                auto_select: false,
                ux_mode: "popup",
                // Prefer the browser-owned FedCM dialog where supported. This avoids
                // fragile OAuth popup rendering in Chromium-based embedded browsers.
                use_fedcm_for_button: true,
                itp_support: true,
            });
            window.google.accounts.id.renderButton(googleDivRef.current, {
                theme: "filled_blue",
                size: "large",
                shape: "pill",
                text: "signup_with",
            });
        } catch (e) {
            console.warn("Google button init failed", e);
        }
    }, [acceptedTerms, gsiReady, googleLogin, navigate]);

    // no manual click handler; rely on the rendered Google button only

    return (
        <AuthShell eyebrow="Get started" title="Create your CompanionAI account" subtitle="Choose Practice or Hiring after sign-up, and switch whenever you need.">
                    <Box component="form" noValidate onSubmit={handleSubmit}>
                        <Stack spacing={{ xs: 2.25, md: 1.35 }}>
                            {successMsg && (
                                <Typography color="success.main">
                                    {successMsg}
                                </Typography>
                            )}
                            {/* Name */}
                            <FormControl fullWidth>
                                <TextField
                                    id="name"
                                    label="Name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    placeholder="Jane Doe"
                                    autoComplete="name"
                                    error={!!errors.name}
                                    helperText={errors.name || undefined}
                                    size="medium"
                                />
                            </FormControl>

                            {/* Email */}
                            <FormControl fullWidth>
                                <TextField
                                    id="email"
                                    label="Email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    placeholder="name@example.com"
                                    autoComplete="email"
                                    error={!!errors.email}
                                    helperText={errors.email || undefined}
                                    size="medium"
                                />
                            </FormControl>

                            {/* Password */}
                            <FormControl fullWidth>
                                <TextField
                                    id="password"
                                    label="Password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    required
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                    error={!!errors.password}
                                    size="medium"
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    aria-label={
                                                        showPassword
                                                            ? "Hide password"
                                                            : "Show password"
                                                    }
                                                    onClick={() =>
                                                        setShowPassword(
                                                            (s) => !s
                                                        )
                                                    }
                                                    edge="end"
                                                >
                                                    {showPassword ? (
                                                        <VisibilityOff />
                                                    ) : (
                                                        <Visibility />
                                                    )}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                                {errors.password && <FormHelperText error>{errors.password}</FormHelperText>}
                                {password && (
                                    <Stack spacing={0.25} mt={0.5}>
                                        {[
                                            { label: "8+ characters", ok: password.length >= 8 },
                                            { label: "Lowercase letter", ok: /[a-z]/.test(password) },
                                            { label: "Uppercase letter", ok: /[A-Z]/.test(password) },
                                            { label: "Number", ok: /\d/.test(password) },
                                            { label: "Special character", ok: /[^A-Za-z0-9]/.test(password) },
                                        ].map(({ label, ok }) => (
                                            <Typography key={label} variant="caption" color={ok ? "success.main" : "text.disabled"}>
                                                {ok ? "✓" : "○"} {label}
                                            </Typography>
                                        ))}
                                    </Stack>
                                )}
                            </FormControl>

                            {/* CAPTCHA */}
                            <Captcha onVerify={(t) => setCaptchaToken(t)} onExpire={() => setCaptchaToken("")} />
                            <FormControlLabel
                                control={<Checkbox checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} />}
                                label={<Typography variant="body2">I agree to the <Link component={RouterLink} to="/terms">Terms</Link> and acknowledge the <Link component={RouterLink} to="/privacy">Privacy Notice</Link>.</Typography>}
                            />
                            {/* Submit */}
                            <Button
                                type="submit"
                                variant="contained"
                                size="large"
                                startIcon={<PersonAddIcon />}
                                disabled={submitting || !acceptedTerms}
                                sx={{
                                    py: 1.25,
                                    borderRadius: 2,
                                    textTransform: "none",
                                    fontWeight: 700,
                                }}
                            >
                                {submitting
                                    ? "Creating account..."
                                    : "Create account"}
                            </Button>

                            {acceptedTerms && (
                                <Stack spacing={2} alignItems="center">
                                    <div ref={googleDivRef} />
                                    <Typography variant="caption" color="text.secondary" align="center">
                                        Google sign-up may not display in embedded browsers. If the Google window is blank, open CompanionAI in Chrome or Safari, or create your account with email.
                                    </Typography>
                                </Stack>
                            )}

                            {submittedEmail && (
                                <Stack spacing={1} alignItems="center">
                                    <Typography variant="body2" color="text.secondary">
                                        Didn’t get the email? Check spam or resend.
                                    </Typography>
                                    <Button
                                        variant="text"
                                        onClick={async () => {
                                            try {
                                                const r = await resendVerification(submittedEmail);
                                                setSuccessMsg(r?.message || "Verification email re-sent");
                                            } catch (e) {
                                                console.warn("Resend verification failed", e);
                                            }
                                        }}
                                    >
                                        Resend verification
                                    </Button>
                                </Stack>
                            )}
                        </Stack>
                    </Box>

                    <Typography
                        align="center"
                        color="text.secondary"
                                sx={{ mt: { xs: 4, md: 2 } }}
                    >
                        Already have an account?{" "}
                        <Link
                            component={RouterLink}
                            to="/login"
                            underline="hover"
                        >
                            Login
                        </Link>
                    </Typography>
        </AuthShell>
    );
};

export default RegisterPage;
