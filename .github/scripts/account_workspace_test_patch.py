from pathlib import Path

path = Path("client/src/__tests__/billingSuccessPage.test.jsx")
text = path.read_text()

text = text.replace(
    'import BillingSuccessPage from "../pages/BillingSuccessPage";\n',
    'import BillingSuccessPage from "../pages/BillingSuccessPage";\nimport { AuthContext } from "../context/AuthContext";\nimport { setWorkspacePreference } from "../utils/workspacePreference";\n',
)
text = text.replace(
    '        localStorage.setItem("companionai:workspace", "hiring");\n        api.get.mockResolvedValue({ data: { plan: "scale" } });\n\n        render(<MemoryRouter><BillingSuccessPage /></MemoryRouter>);',
    '        const user = { _id: "recruiter-1" };\n        setWorkspacePreference("hiring", user._id);\n        api.get.mockResolvedValue({ data: { plan: "scale" } });\n\n        render(\n            <AuthContext.Provider value={{ user }}>\n                <MemoryRouter><BillingSuccessPage /></MemoryRouter>\n            </AuthContext.Provider>\n        );',
)

path.write_text(text)
