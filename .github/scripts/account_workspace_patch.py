from pathlib import Path


def replace(path, old, new, count=1):
    file_path = Path(path)
    text = file_path.read_text()
    if old not in text:
        raise RuntimeError(f"Expected snippet not found in {path}: {old[:120]!r}")
    file_path.write_text(text.replace(old, new, count))


# AuthContext: promote anonymous workspace intent to the account that authenticates.
replace(
    "client/src/context/AuthContext.jsx",
    'import api, { clearAccessToken, setAccessToken, silentRefresh } from "../api/axios";\n',
    'import api, { clearAccessToken, setAccessToken, silentRefresh } from "../api/axios";\nimport { adoptGuestWorkspacePreference } from "../utils/workspacePreference";\n',
)
replace(
    "client/src/context/AuthContext.jsx",
    '            const { data } = await api.get(`/auth/profile`);\n            setUser(data);\n        } catch {\n            setUser(null);\n        }',
    '            const { data } = await api.get(`/auth/profile`);\n            adoptGuestWorkspacePreference(data?._id);\n            setUser(data);\n            return data;\n        } catch {\n            setUser(null);\n            return null;\n        }',
)
replace(
    "client/src/context/AuthContext.jsx",
    '        if (data?.token) setAccessToken(data.token);\n        await fetchProfile();\n    };',
    '        if (data?.token) setAccessToken(data.token);\n        return fetchProfile();\n    };',
    count=2,
)

# Header: all authenticated workspace state is keyed by user id.
replace(
    "client/src/components/Header.jsx",
    'import { useNotifications } from "../context/NotificationContext";\n',
    'import { useNotifications } from "../context/NotificationContext";\nimport { getWorkspacePreference, setWorkspacePreference, WORKSPACE_EVENT } from "../utils/workspacePreference";\n',
)
replace(
    "client/src/components/Header.jsx",
    '    const [workspace, setWorkspace] = useState(() => localStorage.getItem("companionai:workspace") || "practice");\n    useEffect(() => { const sync = (event) => setWorkspace(event.detail || localStorage.getItem("companionai:workspace") || "practice"); window.addEventListener("companionai:workspace", sync); return () => window.removeEventListener("companionai:workspace", sync); }, []);',
    '''    const [workspace, setWorkspace] = useState("practice");
    useEffect(() => {
        setWorkspace(user?._id ? getWorkspacePreference(user._id) || "practice" : "practice");
    }, [user?._id]);
    useEffect(() => {
        const sync = (event) => {
            const detail = event.detail || {};
            if (detail.userId !== user?._id) return;
            setWorkspace(detail.workspace || getWorkspacePreference(user?._id) || "practice");
        };
        window.addEventListener(WORKSPACE_EVENT, sync);
        return () => window.removeEventListener(WORKSPACE_EVENT, sync);
    }, [user?._id]);''',
)
replace(
    "client/src/components/Header.jsx",
    '        if (!hiringRoute && !practiceRoute) return;\n        const next = hiringRoute ? "hiring" : "practice";\n        localStorage.setItem("companionai:workspace", next);\n        setWorkspace(next);\n    }, [location.pathname]);\n    const switchWorkspace = (next) => { localStorage.setItem("companionai:workspace", next); setWorkspace(next); window.dispatchEvent(new CustomEvent("companionai:workspace", { detail: next })); setWorkspaceAnchor(null); setProfileAnchor(null); navigate(next === "hiring" ? "/assessments" : "/dashboard"); };',
    '        if (!user?._id || (!hiringRoute && !practiceRoute)) return;\n        const next = hiringRoute ? "hiring" : "practice";\n        setWorkspacePreference(next, user._id);\n        setWorkspace(next);\n    }, [location.pathname, user?._id]);\n    const switchWorkspace = (next) => { if (user?._id) setWorkspacePreference(next, user._id); setWorkspace(next); setWorkspaceAnchor(null); setProfileAnchor(null); navigate(next === "hiring" ? "/assessments" : "/dashboard"); };',
)

# Landing page stores only anonymous intent.
replace(
    "client/src/pages/LandingPage.jsx",
    'import SiteFooter from "../components/SiteFooter";\n',
    'import SiteFooter from "../components/SiteFooter";\nimport { setWorkspacePreference } from "../utils/workspacePreference";\n',
)
replace(
    "client/src/pages/LandingPage.jsx",
    '        if (!user) localStorage.setItem("companionai:workspace", workspace);',
    '        if (!user) setWorkspacePreference(workspace);',
)

# Login resolves destination after the authenticated profile is known.
replace(
    "client/src/pages/LoginPage.jsx",
    'import { useContext, useEffect, useRef, useState } from "react";',
    'import { useCallback, useContext, useEffect, useRef, useState } from "react";',
)
replace(
    "client/src/pages/LoginPage.jsx",
    'import AuthShell from "../components/AuthShell";\n',
    'import AuthShell from "../components/AuthShell";\nimport { getWorkspaceHome, getWorkspacePreference, setWorkspacePreference } from "../utils/workspacePreference";\n',
)
replace(
    "client/src/pages/LoginPage.jsx",
    '''    const requestedWorkspace = ["practice", "hiring"].includes(workspaceParam) ? workspaceParam : null;
    if (requestedWorkspace) localStorage.setItem("companionai:workspace", requestedWorkspace);
    const authenticatedDestination = requested?.pathname
        ? `${requested.pathname}${requested.search || ""}${requested.hash || ""}`
        : requestedWorkspace === "hiring" || localStorage.getItem("companionai:workspace") === "hiring" ? "/assessments" : "/dashboard";
    const registerPath = requestedWorkspace ? `/register?workspace=${requestedWorkspace}` : "/register";''',
    '''    const requestedWorkspace = ["practice", "hiring"].includes(workspaceParam) ? workspaceParam : null;
    useEffect(() => {
        if (requestedWorkspace) setWorkspacePreference(requestedWorkspace);
    }, [requestedWorkspace]);
    const requestedDestination = requested?.pathname
        ? `${requested.pathname}${requested.search || ""}${requested.hash || ""}`
        : null;
    const authenticatedDestinationFor = useCallback((authenticatedUser) => (
        requestedDestination || getWorkspaceHome(
            requestedWorkspace || getWorkspacePreference(authenticatedUser?._id) || "practice"
        )
    ), [requestedDestination, requestedWorkspace]);
    const registerPath = requestedWorkspace ? `/register?workspace=${requestedWorkspace}` : "/register";''',
)
replace(
    "client/src/pages/LoginPage.jsx",
    '            await login(email, password, captchaToken);\n            navigate(authenticatedDestination, { replace: true });',
    '            const authenticatedUser = await login(email, password, captchaToken);\n            navigate(authenticatedDestinationFor(authenticatedUser), { replace: true });',
)
replace(
    "client/src/pages/LoginPage.jsx",
    '                        await googleLoginRef.current(response.credential);\n                        navigate(authenticatedDestination, { replace: true });',
    '                        const authenticatedUser = await googleLoginRef.current(response.credential);\n                        navigate(authenticatedDestinationFor(authenticatedUser), { replace: true });',
)
replace(
    "client/src/pages/LoginPage.jsx",
    '    }, [authenticatedDestination, gsiReady, navigate]);',
    '    }, [authenticatedDestinationFor, gsiReady, navigate]);',
)

# Register keeps anonymous intent until verification/login, or adopts it immediately for Google signup.
replace(
    "client/src/pages/RegisterPage.jsx",
    'import AuthShell from "../components/AuthShell";\n',
    'import AuthShell from "../components/AuthShell";\nimport { getWorkspaceHome, getWorkspacePreference, setWorkspacePreference } from "../utils/workspacePreference";\n',
)
replace(
    "client/src/pages/RegisterPage.jsx",
    '''    const requestedWorkspace = ["practice", "hiring"].includes(workspaceParam) ? workspaceParam : null;
    if (requestedWorkspace) localStorage.setItem("companionai:workspace", requestedWorkspace);
    const postAuthDestination = requestedWorkspace === "hiring" || localStorage.getItem("companionai:workspace") === "hiring" ? "/assessments" : "/dashboard";
    const loginPath = requestedWorkspace ? `/login?workspace=${requestedWorkspace}` : "/login";''',
    '''    const requestedWorkspace = ["practice", "hiring"].includes(workspaceParam) ? workspaceParam : null;
    useEffect(() => {
        if (requestedWorkspace) setWorkspacePreference(requestedWorkspace);
    }, [requestedWorkspace]);
    const loginPath = requestedWorkspace ? `/login?workspace=${requestedWorkspace}` : "/login";''',
)
replace(
    "client/src/pages/RegisterPage.jsx",
    '                        await googleLogin(response.credential);\n                        navigate(postAuthDestination, { replace: true });',
    '                        const authenticatedUser = await googleLogin(response.credential);\n                        const workspace = requestedWorkspace || getWorkspacePreference(authenticatedUser?._id) || "practice";\n                        navigate(getWorkspaceHome(workspace), { replace: true });',
)
replace(
    "client/src/pages/RegisterPage.jsx",
    '    }, [acceptedTerms, gsiReady, googleLogin, navigate, postAuthDestination]);',
    '    }, [acceptedTerms, gsiReady, googleLogin, navigate, requestedWorkspace]);',
)

# Email verification remains anonymous and therefore reads guest intent only.
replace(
    "client/src/pages/VerifyEmailPage.jsx",
    'import { AuthContext } from "../context/AuthContext";\n',
    'import { AuthContext } from "../context/AuthContext";\nimport { getWorkspacePreference } from "../utils/workspacePreference";\n',
)
replace(
    "client/src/pages/VerifyEmailPage.jsx",
    '    const requestedWorkspace = ["practice", "hiring"].includes(workspaceParam) ? workspaceParam : localStorage.getItem("companionai:workspace");',
    '    const requestedWorkspace = ["practice", "hiring"].includes(workspaceParam) ? workspaceParam : getWorkspacePreference();',
)

# Authenticated guest-only redirects use the current user's preference.
replace(
    "client/src/components/GuestOnlyRoute.jsx",
    'import { AuthContext } from "../context/AuthContext";\n',
    'import { AuthContext } from "../context/AuthContext";\nimport { getWorkspaceHome, getWorkspacePreference } from "../utils/workspacePreference";\n',
)
replace(
    "client/src/components/GuestOnlyRoute.jsx",
    '    const workspaceDestination = typeof localStorage !== "undefined" && localStorage.getItem("companionai:workspace") === "hiring"\n        ? "/assessments"\n        : "/dashboard";',
    '    const workspaceDestination = getWorkspaceHome(getWorkspacePreference(user?._id) || "practice");',
)

# Dashboard onboarding and workspace selection are account-specific.
replace(
    "client/src/pages/DashboardPage.jsx",
    'import { trackEvent } from "../utils/analytics";\n',
    'import { trackEvent } from "../utils/analytics";\nimport { getWorkspacePreference, setWorkspacePreference } from "../utils/workspacePreference";\n',
)
replace(
    "client/src/pages/DashboardPage.jsx",
    '    const [workspaceChosen, setWorkspaceChosen] = useState(() => Boolean(localStorage.getItem("companionai:workspace")));\n    const chooseWorkspace = (workspace) => { localStorage.setItem("companionai:workspace", workspace); setWorkspaceChosen(true); window.dispatchEvent(new CustomEvent("companionai:workspace", { detail: workspace })); if (workspace === "hiring") navigate("/assessments"); };',
    '''    const [workspaceChosen, setWorkspaceChosen] = useState(false);
    useEffect(() => {
        if (user?._id) setWorkspaceChosen(Boolean(getWorkspacePreference(user._id)));
    }, [user?._id]);
    const chooseWorkspace = (workspace) => {
        if (user?._id) setWorkspacePreference(workspace, user._id);
        setWorkspaceChosen(true);
        if (workspace === "hiring") navigate("/assessments");
    };''',
)

# Billing success returns to the current account's workspace.
replace(
    "client/src/pages/BillingSuccessPage.jsx",
    'import { useEffect, useState } from "react";',
    'import { useContext, useEffect, useState } from "react";',
)
replace(
    "client/src/pages/BillingSuccessPage.jsx",
    'import api from "../api/axios";\n',
    'import api from "../api/axios";\nimport { AuthContext } from "../context/AuthContext";\nimport { getWorkspaceHome, getWorkspacePreference } from "../utils/workspacePreference";\n',
)
replace(
    "client/src/pages/BillingSuccessPage.jsx",
    '    const [status, setStatus] = useState("checking");\n    const [activePlan, setActivePlan] = useState("");\n    const returnPath = localStorage.getItem("companionai:workspace") === "hiring" ? "/assessments" : "/dashboard";',
    '    const { user } = useContext(AuthContext);\n    const [status, setStatus] = useState("checking");\n    const [activePlan, setActivePlan] = useState("");\n    const returnPath = getWorkspaceHome(getWorkspacePreference(user?._id) || "practice");',
)

# Fail the refactor if product code still bypasses the helper.
remaining = []
for path in Path("client/src").rglob("*"):
    if not path.is_file() or path.name == "workspacePreference.js":
        continue
    try:
        text = path.read_text()
    except UnicodeDecodeError:
        continue
    if "companionai:workspace" in text:
        remaining.append(str(path))

if remaining:
    raise RuntimeError(f"Raw workspace storage references remain: {remaining}")

print("Account-specific workspace refactor applied cleanly")
