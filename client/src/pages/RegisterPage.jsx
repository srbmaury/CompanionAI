import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import Captcha from "../components/Captcha";

// MUI components
import {
    Box,
    Button,
    Card,
    CardContent,
    FormControl,
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
        if (!validate()) return;

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
        if (window.google && window.google.accounts && window.google.accounts.id) {
            setGsiReady(true);
            return;
        }
        const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
        const onLoad = () => setGsiReady(true);
        if (script) script.addEventListener("load", onLoad);
        return () => {
            if (script) script.removeEventListener("load", onLoad);
        };
    }, []);

    // Render button
    useEffect(() => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
        if (!clientId || !gsiReady || !googleDivRef.current) return;
        try {
            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: async (response) => {
                    try {
                        await googleLogin(response.credential);
                        navigate("/dashboard");
                    } catch {
                        setErrors((prev) => ({ ...prev, password: "Google sign-in failed" }));
                    }
                },
                auto_select: false,
                ux_mode: "popup",
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
    }, [gsiReady, googleLogin, navigate]);

    // no manual click handler; rely on the rendered Google button only

    return (
        <Box
            sx={(theme) => ({
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                px: 2,
                py: 6,
                background:
                    theme.palette.mode === "dark"
                        ? `linear-gradient(135deg, ${theme.palette.background.default}, ${theme.palette.background.paper})`
                        : "linear-gradient(135deg, #f6f9ff 0%, #eef2ff 100%)",
            })}
        >
            <Card
                elevation={3}
                sx={{
                    width: "100%",
                    maxWidth: 840,
                    borderRadius: 3,
                    overflow: "hidden",
                    border: (t) => `1px solid ${t.palette.divider}`,
                }}
            >
                <CardContent sx={{ p: { xs: 3, sm: 5, md: 6 } }}>
                    <Typography variant="h4" fontWeight={700} gutterBottom>
                        Register
                    </Typography>

                    <Box component="form" noValidate onSubmit={handleSubmit}>
                        <Stack spacing={3} mt={3}>
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
                                    helperText={errors.name || " "}
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
                                    helperText={errors.email || " "}
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
                                <FormHelperText error={!!errors.password}>
                                    {errors.password || " "}
                                </FormHelperText>
                            </FormControl>

                            {/* CAPTCHA */}
                            <Captcha onVerify={(t) => setCaptchaToken(t)} onExpire={() => setCaptchaToken("")} />
                            {/* Submit */}
                            <Button
                                type="submit"
                                variant="contained"
                                size="large"
                                startIcon={<PersonAddIcon />}
                                disabled={submitting}
                                sx={{
                                    py: 1.25,
                                    borderRadius: 2,
                                    textTransform: "none",
                                    fontWeight: 700,
                                }}
                            >
                                {submitting
                                    ? "Creating account..."
                                    : "Register"}
                            </Button>

                            <Stack spacing={2} alignItems="center">
                                <div ref={googleDivRef} />
                            </Stack>

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
                        sx={{ mt: 4 }}
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
                </CardContent>
            </Card>
        </Box>
    );
};

export default RegisterPage;
