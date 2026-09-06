from pathlib import Path
import re


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:160]!r}")
    write(path, text.replace(old, new, 1))


def replace_all(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:160]!r}")
    write(path, text.replace(old, new))


def regex_once(path, pattern, replacement, flags=0):
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"Expected one regex match in {path}, got {count}: {pattern[:160]!r}")
    write(path, updated)


# Shared design-system fixes.
theme = "client/src/context/ThemeContext.jsx"
replace_once(
    theme,
    'whiteSpace: "normal", overflowWrap: "anywhere", textAlign: "center"',
    'whiteSpace: "normal", overflowWrap: "normal", wordBreak: "normal", textAlign: "center"',
)
replace_all(theme, 'overflowWrap: "anywhere"', 'overflowWrap: "break-word"')

# Generic header: Evalcue branding + focused Admin navigation.
header = "client/src/components/Header.jsx"
replace_once(header, 'fontSize: 16 }}>C</Box>', 'fontSize: 16 }}>E</Box>')
replace_once(
    header,
    '    const isAdmin = Boolean(user?.role === "admin");\n',
    '    const isAdmin = Boolean(user?.role === "admin");\n'
    '    const isAdminSurface = isAdmin && location.pathname.startsWith("/admin");\n'
    '    const adminNavSx = (path) => ({\n'
    '        color: location.pathname === path ? "primary.main" : "text.secondary",\n'
    '        bgcolor: location.pathname === path ? "action.selected" : "transparent",\n'
    '        "&:hover": { bgcolor: "action.hover", color: "text.primary" },\n'
    '    });\n',
)
replace_once(
    header,
    '<Brand to={user && isAdmin ? "/admin" : "/"} />',
    '<Brand to={user && isAdmin ? "/admin/overview" : "/"} />',
)
replace_once(
    header,
    'sx={{ ml: "auto", display: { xs: "none", md: "flex" } }}',
    'sx={{ ml: "auto", display: { xs: "none", md: isAdminSurface ? "none" : "flex", lg: "flex" } }}',
)
replace_once(
    header,
    '''                                    <Button component={RouterLink} to="/practice" color="inherit">Practice</Button>
                                    <Button component={RouterLink} to="/hire" color="inherit">Hire</Button>
                                    {isAdmin && <>
                                        <Button component={RouterLink} to="/admin/commercial" color="inherit">Commercial</Button>
                                        <Button component={RouterLink} to="/admin/feedback" color="inherit">Feedback</Button>
                                        <Button component={RouterLink} to="/admin/audit" color="inherit">Audit</Button>
                                        <Button component={RouterLink} to="/admin/calibration" color="inherit">AI calibration</Button>
                                    </>}''',
    '''                                    {isAdminSurface ? <>
                                        <Button component={RouterLink} to="/admin/overview" sx={adminNavSx("/admin/overview")}>Overview</Button>
                                        <Button component={RouterLink} to="/admin/commercial" sx={adminNavSx("/admin/commercial")}>Commercial</Button>
                                        <Button component={RouterLink} to="/admin/jobs" sx={adminNavSx("/admin/jobs")}>Jobs</Button>
                                        <Button component={RouterLink} to="/admin/feedback" sx={adminNavSx("/admin/feedback")}>Feedback</Button>
                                        <Button component={RouterLink} to="/admin/audit" sx={adminNavSx("/admin/audit")}>Audit</Button>
                                        <Button component={RouterLink} to="/admin/calibration" sx={adminNavSx("/admin/calibration")}>AI calibration</Button>
                                    </> : <>
                                        <Button component={RouterLink} to="/practice" color="inherit">Practice</Button>
                                        <Button component={RouterLink} to="/hire" color="inherit">Hire</Button>
                                    </>}''',
)
replace_once(
    header,
    'sx={{ display: { xs: "inline-flex", md: "none" } }}><MenuIcon />',
    'sx={{ display: { xs: "inline-flex", md: isAdminSurface ? "inline-flex" : "none", lg: "none" } }}><MenuIcon />',
)
replace_once(
    header,
    '''                                        <MenuItem component={RouterLink} to="/practice" onClick={closeMobile}>Practice</MenuItem>
                                        <MenuItem component={RouterLink} to="/hire" onClick={closeMobile}>Hire</MenuItem>
                                        {isAdmin && <>
                                            <Divider />
                                            <MenuItem component={RouterLink} to="/admin/commercial" onClick={closeMobile}>Commercial</MenuItem>
                                            <MenuItem component={RouterLink} to="/admin/feedback" onClick={closeMobile}>Feedback</MenuItem>
                                            <MenuItem component={RouterLink} to="/admin/audit" onClick={closeMobile}>Audit</MenuItem>
                                            <MenuItem component={RouterLink} to="/admin/calibration" onClick={closeMobile}>AI calibration</MenuItem>
                                        </>}''',
    '''                                        {isAdminSurface ? <>
                                            <MenuItem component={RouterLink} to="/admin/overview" selected={location.pathname === "/admin/overview"} onClick={closeMobile}>Overview</MenuItem>
                                            <MenuItem component={RouterLink} to="/admin/commercial" selected={location.pathname === "/admin/commercial"} onClick={closeMobile}>Commercial</MenuItem>
                                            <MenuItem component={RouterLink} to="/admin/jobs" selected={location.pathname === "/admin/jobs"} onClick={closeMobile}>Jobs</MenuItem>
                                            <MenuItem component={RouterLink} to="/admin/feedback" selected={location.pathname === "/admin/feedback"} onClick={closeMobile}>Feedback</MenuItem>
                                            <MenuItem component={RouterLink} to="/admin/audit" selected={location.pathname === "/admin/audit"} onClick={closeMobile}>Audit</MenuItem>
                                            <MenuItem component={RouterLink} to="/admin/calibration" selected={location.pathname === "/admin/calibration"} onClick={closeMobile}>AI calibration</MenuItem>
                                        </> : <>
                                            <MenuItem component={RouterLink} to="/practice" onClick={closeMobile}>Practice</MenuItem>
                                            <MenuItem component={RouterLink} to="/hire" onClick={closeMobile}>Hire</MenuItem>
                                        </>}''',
)

# Landing page: canonical routes and resilient CTA sizing.
landing = "client/src/pages/LandingPage.jsx"
replace_once(landing, '    const primaryPath = user ? "/dashboard" : "/register?workspace=practice";', '    const primaryPath = user ? "/practice/dashboard" : "/practice/register";')
replace_once(landing, '    const hiringPath = user ? "/assessments" : "/register?workspace=hiring";', '    const hiringPath = user ? "/hire/assessments" : "/hire/register";')
replace_once(
    landing,
    'variant="outlined" size="large" sx={{ borderColor: "rgba(255,255,255,.65)", color: "white", px: 3 }}',
    'variant="outlined" size="large" sx={{ borderColor: "rgba(255,255,255,.65)", color: "white", px: 3, flexShrink: 0 }}',
)

# Product header: stable active state on nested routes + complete mobile account menu.
product_header = "client/src/components/ProductHeader.jsx"
replace_once(
    product_header,
    '''export const isProductNavItemActive = (location, item) => {
    if (location.pathname !== item.path) return false;
    return item.hash ? location.hash === item.hash : !location.hash;
};''',
    '''export const isProductNavItemActive = (location, item) => {
    if (item.matchPrefix && location.pathname.startsWith(item.matchPrefix)) return true;
    if (location.pathname !== item.path) return false;
    return item.hash ? location.hash === item.hash : !location.hash;
};''',
)
replace_once(
    product_header,
    '{ label: "Overview", path: "/practice/dashboard" },',
    '{ label: "Overview", path: "/practice/dashboard", matchPrefix: "/practice/interviews/" },',
)
replace_once(
    product_header,
    '{ label: "Assessments", path: "/hire/assessments", hash: "#assessment-list" });',
    '{ label: "Assessments", path: "/hire/assessments", hash: "#assessment-list", matchPrefix: "/hire/assessments/" });',
)
replace_once(
    product_header,
    '<Tooltip title="Account"><IconButton onClick={(event) => setProfileAnchor(event.currentTarget)} aria-label="Account menu"><Avatar sx={{ width: 34, height: 34 }}>',
    '<Tooltip title="Account"><IconButton onClick={(event) => setProfileAnchor(event.currentTarget)} aria-label="Account menu" sx={{ display: { xs: "none", sm: "inline-flex" } }}><Avatar sx={{ width: 34, height: 34 }}>',
)
replace_once(
    product_header,
    '''                                {user ? <>
                                    {navigation.map((item) => renderNavItem(item, true))}
                                    {(surface === "practice" || permissions.canManageAssessments) && <MenuItem onClick={openPrimaryAction}><AddRounded sx={{ mr: 1.25 }} />{surface === "hiring" ? "New assessment" : "New practice"}</MenuItem>}
                                </> : <>''',
    '''                                {user ? <>
                                    {navigation.map((item) => renderNavItem(item, true))}
                                    {(surface === "practice" || permissions.canManageAssessments) && <MenuItem onClick={openPrimaryAction}><AddRounded sx={{ mr: 1.25 }} />{surface === "hiring" ? "New assessment" : "New practice"}</MenuItem>}
                                    <Divider />
                                    {surface === "practice" && <MenuItem component={RouterLink} to="/practice/profile" onClick={() => setMobileAnchor(null)}><PersonOutlineRounded sx={{ mr: 1.25 }} />Profile</MenuItem>}
                                    <MenuItem onClick={() => { setMobileAnchor(null); openOtherProduct(); }}><SwapHorizRounded sx={{ mr: 1.25 }} />{config.crossLabel}</MenuItem>
                                    <MenuItem onClick={() => { setMobileAnchor(null); setFeedbackOpen(true); }}><RateReviewOutlined sx={{ mr: 1.25 }} />Send feedback</MenuItem>
                                    {user?.role === "admin" && <MenuItem component={RouterLink} to="/admin/overview" onClick={() => setMobileAnchor(null)}><SettingsOutlined sx={{ mr: 1.25 }} />Admin</MenuItem>}
                                    <MenuItem onClick={handleLogout}><LogoutRounded sx={{ mr: 1.25 }} />Sign out</MenuItem>
                                </> : <>''',
)

# Canonical internal links avoid redirect flicker.
replace_once("client/src/pages/ExperiencesPage.jsx", 'to="/saved-experiences"', 'to="/practice/saved-experiences"')
replace_once("client/src/pages/ProfilePage.jsx", 'navigate("/pricing")', 'navigate("/practice/pricing")')
replace_once("client/src/pages/CreateInterviewPage.jsx", 'navigate(`/interviews/${data._id}`);', 'navigate(`/practice/interviews/${data._id}`);')

# Profile layout: remove negative-margin composition hack.
replace_once(
    "client/src/pages/ProfileSettingsPage.jsx",
    'sx={{ pb: { xs: 4, md: 6 }, mt: { xs: -1, md: -2 } }}',
    'sx={{ pb: { xs: 4, md: 6 }, pt: 0 }}',
)

# Hiring workspace hierarchy + denser cards.
assessments = "client/src/pages/AssessmentsPage.jsx"
replace_once(assessments, '>Candidate assessments</Typography>', '>Hiring workspace</Typography>')
replace_once(
    assessments,
    'Manage every candidate interview, track completion, and review evidence from one hiring workspace.',
    'Review the hiring pipeline, assessments, and candidate evidence without switching contexts.',
)
replace_once(assessments, '>Hiring overview</Typography>', '>Overview</Typography>')
replace_once(assessments, '>Your assessments</Typography>', '>Assessments</Typography>')
replace_once(
    assessments,
    'return <Card variant="outlined" key={item._id}><CardContent><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2}><Box><Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">',
    'return <Card variant="outlined" key={item._id} sx={{ borderRadius: 3 }}><CardContent sx={{ p: { xs: 2.25, sm: 2.5 }, "&:last-child": { pb: { xs: 2.25, sm: 2.5 } } }}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={2.5}><Box sx={{ flex: 1, minWidth: 0 }}><Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">',
)
replace_once(
    assessments,
    '<Stack direction="row" alignItems="center">{canManageAssessments && item.status === "active"',
    '<Stack direction="row" alignItems="center" spacing={.75} flexShrink={0}>{canManageAssessments && item.status === "active"',
)

# Admin density and a copy fix.
replace_once("client/src/pages/AdminOverviewPage.jsx", '<Container maxWidth="xl"', '<Container maxWidth="lg"')
replace_once("client/src/pages/HiringTeamPage.jsx", 'must already have a Evalcue AI account', 'must already have an Evalcue AI account')

# Shared back-button hierarchy should use canonical product paths.
nav = "client/src/utils/navigationHierarchy.js"
for old, new in {
    '    "/dashboard",': '    "/practice/dashboard",',
    '    "/resume-review",': '    "/practice/resume-review",',
    '    "/progress",': '    "/practice/progress",',
    '    "/experiences",': '    "/practice/company-insights",',
    '    "/profile",': '    "/practice/profile",',
    '    "/pricing",': '    "/practice/pricing",',
    '    "/billing/success",': '    "/practice/billing/success",',
    '    "/hiring/team",': '    "/hire/team",',
    '    "/hiring/sso",': '    "/hire/sso",',
    '    if (pathname === "/assessments") return !search;': '    if (pathname === "/hire/assessments") return !search;',
    '    // The builder is intentionally nested so /assessments?create=1 keeps a Back action.': '    // The builder is intentionally nested so /hire/assessments?create=1 keeps a Back action.',
}.items():
    replace_once(nav, old, new)

# Navigation regression coverage.
ph_test = "client/src/__tests__/productHeaderNavigation.test.js"
replace_once(
    ph_test,
    'const assessments = { label: "Assessments", path: "/hire/assessments", hash: "#assessment-list" };',
    'const assessments = { label: "Assessments", path: "/hire/assessments", hash: "#assessment-list", matchPrefix: "/hire/assessments/" };',
)
replace_once(
    ph_test,
    '''    it("highlights only Assessments on the assessment-list hash", () => {
        const location = { pathname: "/hire/assessments", hash: "#assessment-list" };
        expect(isProductNavItemActive(location, overview)).toBe(false);
        expect(isProductNavItemActive(location, candidates)).toBe(false);
        expect(isProductNavItemActive(location, assessments)).toBe(true);
    });
});''',
    '''    it("highlights only Assessments on the assessment-list hash", () => {
        const location = { pathname: "/hire/assessments", hash: "#assessment-list" };
        expect(isProductNavItemActive(location, overview)).toBe(false);
        expect(isProductNavItemActive(location, candidates)).toBe(false);
        expect(isProductNavItemActive(location, assessments)).toBe(true);
    });

    it("keeps Assessments active while reviewing a specific assessment", () => {
        const location = { pathname: "/hire/assessments/a1", hash: "" };
        expect(isProductNavItemActive(location, overview)).toBe(false);
        expect(isProductNavItemActive(location, candidates)).toBe(false);
        expect(isProductNavItemActive(location, assessments)).toBe(true);
    });
});''',
)

nav_test = "client/src/__tests__/navigationHierarchy.test.js"
for old, new in {
    '        "/dashboard",': '        "/practice/dashboard",',
    '        "/resume-review",': '        "/practice/resume-review",',
    '        "/progress",': '        "/practice/progress",',
    '        "/experiences",': '        "/practice/company-insights",',
    '        "/profile",': '        "/practice/profile",',
    '        "/pricing",': '        "/practice/pricing",',
    '        "/billing/success",': '        "/practice/billing/success",',
    '        "/hiring/team",': '        "/hire/team",',
    'expect(shouldShowGlobalBack({ pathname: "/assessments", search: "", hash: "" })).toBe(false);': 'expect(shouldShowGlobalBack({ pathname: "/hire/assessments", search: "", hash: "" })).toBe(false);',
    'expect(shouldShowGlobalBack({ pathname: "/assessments", search: "", hash: "#candidate-pipeline" })).toBe(false);': 'expect(shouldShowGlobalBack({ pathname: "/hire/assessments", search: "", hash: "#candidate-pipeline" })).toBe(false);',
    'expect(shouldShowGlobalBack({ pathname: "/assessments", search: "", hash: "#assessment-list" })).toBe(false);': 'expect(shouldShowGlobalBack({ pathname: "/hire/assessments", search: "", hash: "#assessment-list" })).toBe(false);',
    '["/assessments", "?create=1"],': '["/hire/assessments", "?create=1"],',
    '["/assessments", "?create=1&edit=a1"],': '["/hire/assessments", "?create=1&edit=a1"],',
    '["/assessments/a1", ""],': '["/hire/assessments/a1", ""],',
    '["/assessments/a1/preview", ""],': '["/hire/assessments/a1/preview", ""],',
    '["/create-interview", ""],': '["/practice/new", ""],',
    '["/interviews/i1", ""],': '["/practice/interviews/i1", ""],',
    '["/resume-reviews", ""],': '["/practice/resume-reviews", ""],',
    '["/resume-match", ""],': '["/practice/resume-match", ""],',
    '["/resumes", ""],': '["/practice/resumes", ""],',
    '["/saved-experiences", ""],': '["/practice/saved-experiences", ""],',
}.items():
    replace_once(nav_test, old, new)

print("UI consistency cleanup applied successfully")
