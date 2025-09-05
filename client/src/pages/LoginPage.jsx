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
    Divider,
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
import { Login as LoginIcon, Visibility, VisibilityOff } from "@mui/icons-material";

const LoginPage = () => {
    const navigate = useNavigate();
    const { login, googleLogin, resendVerification } = useContext(AuthContext);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [captchaToken, setCaptchaToken] = useState("");
    const [gsiReady, setGsiReady] = useState(false);
    const googleDivRef = useRef(null);

    // simple local validation state (optional)
    const [errors, setErrors] = useState({ email: "", password: "" });

    const validate = () => {
        const next = { email: "", password: "" };
        if (!email) next.email = "Email is required";
        if (!password) next.password = "Password is required";
        setErrors(next);
        return !next.email && !next.password;
    };

    // CAPTCHA not shown in development; enable when CAPTCHA_ENABLED in prod

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setSubmitting(true);
        try {
            await login(email, password, captchaToken);
            navigate("/dashboard");
        } catch (err) {
            const msg = err?.response?.data?.message || "Invalid credentials";
            setErrors((prev) => ({ ...prev, password: msg }));
        } finally {
            setSubmitting(false);
        }
    };

    // Detect when GIS script is ready
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

    // Google Identity Services button
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
                    } catch (e) {
                        console.error(e);
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
                text: "signin_with",
            });
        } catch (e) {
            console.error("GIS button render error", e);
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
                        Login
                    </Typography>

                    <Box component="form" noValidate onSubmit={handleSubmit}>
                        <Stack spacing={3} mt={3}>
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
                                    autoComplete="current-password"
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
                                <Typography variant="body2" align="right" sx={{ mt: 1 }}>
                                    <Link component={RouterLink} to="/forgot-password" underline="hover">
                                        Forgot password?
                                    </Link>
                                </Typography>
                            </FormControl>

                            {errors.password === "Email not verified" && (
                                <Stack spacing={1}>
                                    <Typography variant="body2" color="text.secondary">
                                        Didn’t receive the verification email?
                                    </Typography>
                                    <Button
                                        size="small"
                                        variant="text"
                                        onClick={async () => {
                                            try {
                                                const r = await resendVerification(email);
                                                setErrors((p) => ({ ...p, password: r?.message || "Verification email sent" }));
                                            } catch (e) {
                                                console.error(e);
                                            }
                                        }}
                                    >
                                        Resend verification
                                    </Button>
                                </Stack>
                            )}
                            {/* CAPTCHA: server validates only in prod; safe in dev */}
                            <Captcha onVerify={(t) => setCaptchaToken(t)} onExpire={() => setCaptchaToken("")} />
                            {/* Submit */}
                            <Button
                                type="submit"
                                variant="contained"
                                size="large"
                                startIcon={<LoginIcon />}
                                disabled={submitting}
                                sx={{
                                    py: 1.25,
                                    borderRadius: 2,
                                    textTransform: "none",
                                    fontWeight: 700,
                                }}
                            >
                                {submitting ? "Signing in..." : "Login"}
                            </Button>
                        </Stack>
                    </Box>

                    <Divider sx={{ my: 4 }} />

                    <Stack spacing={2} alignItems="center">
                        <div ref={googleDivRef} />
                    </Stack>

                    <Typography align="center" color="text.secondary">
                        Don’t have an account?{" "}
                        <Link
                            component={RouterLink}
                            to="/register"
                            underline="hover"
                        >
                            Register
                        </Link>
                    </Typography>
                </CardContent>
            </Card>
        </Box>
    );
};

export default LoginPage;
