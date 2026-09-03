from pathlib import Path


# Assessment workspace: only Owner/Admin/Recruiter can enter the builder.
p = Path("client/src/pages/AssessmentsPage.jsx")
text = p.read_text()
replacements = [
    (
        'import { useCallback, useEffect, useMemo, useRef, useState } from "react";',
        'import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";',
    ),
    (
        'import { useNotify } from "../context/NotificationContext";\n',
        'import { useNotify } from "../context/NotificationContext";\nimport { OrganizationContext } from "../context/OrganizationContext";\n',
    ),
    (
        '    const notify = useNotify();\n    const [searchParams, setSearchParams] = useSearchParams();',
        '    const notify = useNotify();\n    const currentRole = useContext(OrganizationContext)?.currentRole || "owner";\n    const canManageAssessments = ["owner", "admin", "recruiter"].includes(currentRole);\n    const [searchParams, setSearchParams] = useSearchParams();',
    ),
    (
        '    const [showCreate, setShowCreate] = useState(searchParams.get("create") === "1");',
        '    const [showCreate, setShowCreate] = useState(canManageAssessments && searchParams.get("create") === "1");',
    ),
    (
        '    useEffect(() => { if (searchParams.get("create") !== "1" && !location.state?.openCreate) return; setShowCreate(true); const timer = setTimeout(() => { if (typeof createFormRef.current?.scrollIntoView === "function") createFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" }); }, 50); return () => clearTimeout(timer); }, [location.key, location.state, searchParams]);',
        '    useEffect(() => { if (!canManageAssessments || (searchParams.get("create") !== "1" && !location.state?.openCreate)) return; setShowCreate(true); const timer = setTimeout(() => { if (typeof createFormRef.current?.scrollIntoView === "function") createFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" }); }, 50); return () => clearTimeout(timer); }, [canManageAssessments, location.key, location.state, searchParams]);',
    ),
    (
        '    useEffect(() => { if (!editId) return; let active = true;',
        '    useEffect(() => { if (!canManageAssessments || !editId) return; let active = true;',
    ),
    (
        '}, [editId, notify]);\n',
        '}, [canManageAssessments, editId, notify]);\n',
    ),
    (
        '    const create = async (event) => { event.preventDefault(); const intent = event.nativeEvent?.submitter?.value || "draft";',
        '    const create = async (event) => { event.preventDefault(); if (!canManageAssessments) { setError("Your organization role cannot create or edit assessments."); return; } const intent = event.nativeEvent?.submitter?.value || "draft";',
    ),
    (
        'delete assessmentInput.owner; delete assessmentInput.shareToken;',
        'delete assessmentInput.organization; delete assessmentInput.createdBy; delete assessmentInput.shareToken;',
    ),
    (
        'action={!showCreate ? <Button color="inherit" onClick={() => setShowCreate(true)}>Create one</Button> : null}',
        'action={canManageAssessments && !showCreate ? <Button color="inherit" onClick={() => setShowCreate(true)}>Create one</Button> : null}',
    ),
]
for old, new in replacements:
    if old not in text:
        raise RuntimeError(f"Expected AssessmentsPage snippet not found: {old[:140]!r}")
    text = text.replace(old, new, 1)

create_button = '<Button variant={showCreate ? "outlined" : "contained"} startIcon={showCreate ? <CloseRounded /> : <AddRounded />} onClick={() => { const next = !showCreate; setShowCreate(next); setSearchParams(next ? { create: "1" } : {}); }}>{showCreate ? "Cancel" : "Create assessment"}</Button>'
if create_button not in text:
    raise RuntimeError('Assessment create button not found')
text = text.replace(create_button, '{canManageAssessments && ' + create_button + '}', 1)
p.write_text(text)

# Assessment report: reviewers/hiring managers can review evidence, not mutate assessment setup.
p = Path("client/src/pages/AssessmentReportPage.jsx")
text = p.read_text()
replacements = [
    (
        'import { lazy, Suspense, useCallback, useEffect, useState } from "react";',
        'import { lazy, Suspense, useCallback, useContext, useEffect, useState } from "react";',
    ),
    (
        'import { useNotify } from "../context/NotificationContext";\n',
        'import { useNotify } from "../context/NotificationContext";\nimport { OrganizationContext } from "../context/OrganizationContext";\n',
    ),
    (
        '    const { assessmentId } = useParams(); const location = useLocation(); const navigate = useNavigate(); const notify = useNotify(); const [data, setData] = useState(null);',
        '    const { assessmentId } = useParams(); const location = useLocation(); const navigate = useNavigate(); const notify = useNotify(); const currentRole = useContext(OrganizationContext)?.currentRole || "owner"; const canManageAssessments = ["owner", "admin", "recruiter"].includes(currentRole); const [data, setData] = useState(null);',
    ),
]
for old, new in replacements:
    if old not in text:
        raise RuntimeError(f"Expected AssessmentReportPage snippet not found: {old[:140]!r}")
    text = text.replace(old, new, 1)

old_actions = '<Stack direction={{ xs: "column", sm: "row" }} gap={1} alignItems="stretch" flexWrap="wrap"><Button component={RouterLink} to={`/assessments/${assessmentId}/preview`}>Preview candidate experience</Button>{assessment.status === "draft" && <Button component={RouterLink} to={`/assessments?create=1&edit=${assessmentId}`}>Edit draft</Button>}{assessment.status === "active" && <Button startIcon={<ContentCopyRounded />} onClick={() => navigator.clipboard.writeText(link)}>Copy link</Button>}<Button disabled={!attempts.length} onClick={exportCsv}>Export CSV</Button>{assessment.status === "draft" ? <Button variant="contained" onClick={() => changeStatus("active")}>Publish assessment</Button> : assessment.status === "scheduled" ? <><Button variant="contained" onClick={() => changeStatus("active")}>Publish now</Button><Button variant="outlined" onClick={() => changeStatus("draft")}>Cancel schedule</Button></> : assessment.status === "active" ? <Button variant="outlined" onClick={() => changeStatus("closed")}>Close</Button> : assessment.status === "closed" ? <Button variant="outlined" onClick={() => changeStatus("active")}>Reopen</Button> : null}</Stack>'
new_actions = '<Stack direction={{ xs: "column", sm: "row" }} gap={1} alignItems="stretch" flexWrap="wrap"><Button component={RouterLink} to={`/assessments/${assessmentId}/preview`}>Preview candidate experience</Button>{canManageAssessments && assessment.status === "draft" && <Button component={RouterLink} to={`/assessments?create=1&edit=${assessmentId}`}>Edit draft</Button>}{canManageAssessments && assessment.status === "active" && <Button startIcon={<ContentCopyRounded />} onClick={() => navigator.clipboard.writeText(link)}>Copy link</Button>}<Button disabled={!attempts.length} onClick={exportCsv}>Export CSV</Button>{canManageAssessments && (assessment.status === "draft" ? <Button variant="contained" onClick={() => changeStatus("active")}>Publish assessment</Button> : assessment.status === "scheduled" ? <><Button variant="contained" onClick={() => changeStatus("active")}>Publish now</Button><Button variant="outlined" onClick={() => changeStatus("draft")}>Cancel schedule</Button></> : assessment.status === "active" ? <Button variant="outlined" onClick={() => changeStatus("closed")}>Close</Button> : assessment.status === "closed" ? <Button variant="outlined" onClick={() => changeStatus("active")}>Reopen</Button> : null)}</Stack>'
if old_actions not in text:
    raise RuntimeError('Assessment report action bar snippet not found')
text = text.replace(old_actions, new_actions, 1)

invite_marker = '        <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}><Typography component="h2" variant="h6" fontWeight={800}>Invite candidates</Typography>'
invite_start = text.find(invite_marker)
if invite_start == -1:
    raise RuntimeError('Invite candidates section not found')
invite_end = text.find('</Paper>', invite_start)
if invite_end == -1:
    raise RuntimeError('Invite candidates section end not found')
invite_end += len('</Paper>')
section = text[invite_start:invite_end].strip()
text = text[:invite_start] + '        {canManageAssessments && (' + section + ')}' + text[invite_end:]
p.write_text(text)

print("Hiring role UI aligned")
