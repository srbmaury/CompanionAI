from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))

# Mount the SSO API and keep auth/SSO responses non-cacheable.
replace_once(
    "server/src/app.js",
    'import organizationRoutes from "./routes/organizationRoutes.js";\n',
    'import organizationRoutes from "./routes/organizationRoutes.js";\nimport ssoRoutes from "./routes/ssoRoutes.js";\n',
)
replace_once(
    "server/src/app.js",
    'if (req.path.startsWith("/api/auth") || req.path.startsWith("/api/assessments")) {',
    'if (req.path.startsWith("/api/auth") || req.path.startsWith("/api/sso") || req.path.startsWith("/api/assessments")) {',
)
replace_once(
    "server/src/app.js",
    'app.use("/api/organizations", organizationRoutes);\napp.use("/api/assessments", assessmentRoutes);',
    'app.use("/api/organizations", organizationRoutes);\napp.use("/api/sso", ssoRoutes);\napp.use("/api/assessments", assessmentRoutes);',
)

# SSO-only accounts must not be able to bypass enterprise identity through password reset.
replace_once(
    "server/src/controllers/authController.js",
    'return res.status(400).json({ message: "Use Google Sign-In for this account" });',
    'return res.status(400).json({ message: user.provider === "sso" ? "Use work SSO for this account" : "Use Google Sign-In for this account" });',
)
replace_once(
    "server/src/controllers/authController.js",
    'return res.status(400).json({ message: "Password change not available for Google accounts" });',
    'return res.status(400).json({ message: "Password changes are only available for email/password accounts" });',
)
replace_once(
    "server/src/controllers/authController.js",
    'if (!user.isVerified) return res.json({ message: "If the email exists, a reset link has been sent" });\n\n        const token = crypto.randomBytes(32).toString("hex");',
    'if (!user.isVerified) return res.json({ message: "If the email exists, a reset link has been sent" });\n        if (user.provider !== "local") return res.json({ message: "If the email exists, a reset link has been sent" });\n\n        const token = crypto.randomBytes(32).toString("hex");',
)
replace_once(
    "server/src/controllers/authController.js",
    'return res.status(400).json({ message: "Password reset not available for Google accounts" });',
    'return res.status(400).json({ message: "Password reset is only available for email/password accounts" });',
)

# Give Owner/Admin users a visible route to SSO configuration.
replace_once(
    "client/src/pages/HiringTeamPage.jsx",
    'import { Navigate } from "react-router-dom";',
    'import { Link as RouterLink, Navigate } from "react-router-dom";',
)
replace_once(
    "client/src/pages/HiringTeamPage.jsx",
    '<Typography color="text.secondary" mt={1}>Manage your team, shared candidate-interview capacity, and organization billing.</Typography>',
    '<Typography color="text.secondary" mt={1}>Manage your team, shared candidate-interview capacity, organization billing, and enterprise access.</Typography>\n                    <Button component={RouterLink} to="/hiring/sso" variant="outlined" sx={{ mt: 2 }}>Configure work SSO</Button>',
)
replace_once(
    "client/src/pages/HiringTeamPage.jsx",
    'Custom contracts, SSO/API and retention controls can be added when enterprise demand is validated.',
    'Custom capacity, OIDC work SSO, API access, and retention controls for enterprise hiring teams.',
)

# Treat public docs/callback and SSO settings as intentional top-level destinations.
replace_once(
    "client/src/utils/navigationHierarchy.js",
    '    "/terms",\n    "/dashboard",',
    '    "/terms",\n    "/docs",\n    "/sso/callback",\n    "/dashboard",',
)
replace_once(
    "client/src/utils/navigationHierarchy.js",
    '    "/hiring/team",\n]);',
    '    "/hiring/team",\n    "/hiring/sso",\n]);',
)

# Make documentation crawlable from a normal internal anchor.
replace_once(
    "client/src/components/SiteFooter.jsx",
    '<Stack direction="row" spacing={3}>\n                        <Link component={RouterLink} to="/privacy" color="text.secondary">Privacy</Link>',
    '<Stack direction="row" spacing={3}>\n                        <Link component={RouterLink} to="/docs" color="text.secondary">Docs</Link>\n                        <Link component={RouterLink} to="/privacy" color="text.secondary">Privacy</Link>',
)

# Document the production secret and optional non-enterprise dev/test override.
replace_once(
    "server/.env.example",
    '# Google OAuth\nGOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com\n',
    '# Google OAuth\nGOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com\n\n# Organization OIDC SSO\n# Required before saving an OIDC client secret. Use a long random value and keep it stable.\nSSO_ENCRYPTION_KEY=replace-with-at-least-32-random-characters\n# Development/test only. Production SSO requires the Enterprise Hiring plan.\nSSO_ALLOW_NON_ENTERPRISE=false\n',
)

# Keep README product/security claims aligned with the implementation.
replace_once(
    "README.md",
    '- Authentication: email verification, Google Sign-In, rotating access/refresh tokens, logout, password reset, and account deletion\n',
    '- Authentication: email verification, Google Sign-In, organization OIDC work SSO, rotating access/refresh tokens, logout, password reset, and account deletion\n',
)
replace_once(
    "README.md",
    '  - Stripe requires `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRACTICE_PRO_PRICE_ID`, `STRIPE_HIRING_STARTER_PRICE_ID`, and `STRIPE_HIRING_GROWTH_PRICE_ID`\n',
    '  - Stripe requires `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRACTICE_PRO_PRICE_ID`, `STRIPE_HIRING_STARTER_PRICE_ID`, and `STRIPE_HIRING_GROWTH_PRICE_ID`\n  - Organization OIDC SSO requires a stable `SSO_ENCRYPTION_KEY` (32+ random characters); production enablement is gated to Enterprise Hiring\n',
)
