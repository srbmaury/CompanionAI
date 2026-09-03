from pathlib import Path

path = Path("client/src/components/Header.jsx")
text = path.read_text()

replacements = [
    (
        'import { AuthContext } from "../context/AuthContext";\n',
        'import { AuthContext } from "../context/AuthContext";\nimport { OrganizationContext } from "../context/OrganizationContext";\n',
    ),
    (
        '    const { notifications, clearNotifications } = useNotifications();\n    const [workspace, setWorkspace] = useState("practice");',
        '    const { notifications, clearNotifications } = useNotifications();\n    const organizationContext = useContext(OrganizationContext);\n    const currentOrganizationRole = organizationContext?.currentRole || null;\n    const canManageAssessments = ["owner", "admin", "recruiter"].includes(currentOrganizationRole);\n    const [workspace, setWorkspace] = useState("practice");',
    ),
    (
        '        const hiringRoute = location.pathname.startsWith("/assessments");',
        '        const hiringRoute = location.pathname.startsWith("/assessments") || location.pathname.startsWith("/hiring");',
    ),
    (
        '                                    <Button onClick={() => openHiringSection("assessment-list")} sx={{ px: 1.5, color: location.hash === "#assessment-list" ? "primary.main" : "text.secondary", bgcolor: location.hash === "#assessment-list" ? "action.selected" : "transparent" }}>Assessments</Button>\n',
        '                                    <Button onClick={() => openHiringSection("assessment-list")} sx={{ px: 1.5, color: location.hash === "#assessment-list" ? "primary.main" : "text.secondary", bgcolor: location.hash === "#assessment-list" ? "action.selected" : "transparent" }}>Assessments</Button>\n                                    <Button component={RouterLink} to="/hiring/team" sx={navSx("/hiring/team")}>Team</Button>\n',
    ),
    (
        '                                <Button component={workspace === "hiring" ? "button" : RouterLink} to={workspace === "hiring" ? undefined : "/create-interview"} onClick={workspace === "hiring" ? openNewAssessment : undefined} variant="contained" startIcon={<AddRounded />} sx={{ ml: 1, px: 2 }}>{workspace === "hiring" ? "New assessment" : "New practice"}</Button>',
        '                                {(workspace !== "hiring" || canManageAssessments) && <Button component={workspace === "hiring" ? "button" : RouterLink} to={workspace === "hiring" ? undefined : "/create-interview"} onClick={workspace === "hiring" ? openNewAssessment : undefined} variant="contained" startIcon={<AddRounded />} sx={{ ml: 1, px: 2 }}>{workspace === "hiring" ? "New assessment" : "New practice"}</Button>}',
    ),
    (
        '                                {workspace === "hiring" ? <MenuItem onClick={() => { close(); openNewAssessment(); }}>New assessment</MenuItem> : <MenuItem component={RouterLink} to="/create-interview" onClick={close}>New practice</MenuItem>}',
        '                                {workspace === "hiring" ? (canManageAssessments && <MenuItem onClick={() => { close(); openNewAssessment(); }}>New assessment</MenuItem>) : <MenuItem component={RouterLink} to="/create-interview" onClick={close}>New practice</MenuItem>}',
    ),
    (
        '                                {workspace === "hiring" && <MenuItem onClick={() => { close(); openHiringSection("assessment-list"); }}>Assessments</MenuItem>}\n',
        '                                {workspace === "hiring" && <MenuItem onClick={() => { close(); openHiringSection("assessment-list"); }}>Assessments</MenuItem>}\n                                {workspace === "hiring" && <MenuItem component={RouterLink} to="/hiring/team" onClick={close}>Team & organization</MenuItem>}\n',
    ),
]

for old, new in replacements:
    if old not in text:
        raise RuntimeError(f"Expected Header snippet not found: {old[:120]!r}")
    text = text.replace(old, new, 1)

path.write_text(text)
print("Hiring header role UI patched")
