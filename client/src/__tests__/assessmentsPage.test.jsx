import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AssessmentsPage from "../pages/AssessmentsPage";
import { OrganizationContext } from "../context/OrganizationContext";

const { get, post, patch } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("../api/axios", () => ({ default: { get, post, patch } }));

const ownerOrganization = {
    activeOrganization: { _id: "org-1", name: "Acme", role: "owner" },
    currentRole: "owner",
    loading: false,
};

const renderAssessments = (entry) => render(
    <OrganizationContext.Provider value={ownerOrganization}>
        <MemoryRouter initialEntries={[entry]}><AssessmentsPage /></MemoryRouter>
    </OrganizationContext.Provider>,
);

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("assessment workspace hierarchy", () => {
    it("shows existing assessments before keeping creation controls on demand", async () => {
        get.mockResolvedValue({ data: { items: [{ _id: "a1", title: "Backend screen", jobRole: "Engineer", status: "active", attemptCount: 2, submittedCount: 1, shareToken: "share-token" }], totalPages: 1 } });
        renderAssessments("/hire/assessments");
        expect(await screen.findByRole("heading", { name: "Backend screen" })).toBeTruthy();
        expect(screen.queryByRole("heading", { name: "Create assessment" })).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Create assessment" }));
        expect(screen.getByRole("heading", { name: "Create assessment" })).toBeTruthy();
        await vi.waitFor(() => expect(screen.queryByRole("heading", { name: "Your assessments" })).toBeNull());
        expect(screen.queryByRole("heading", { name: "Candidate pipeline" })).toBeNull();
    });

    it("gives recruiters a cross-assessment candidate pipeline", async () => {
        get.mockImplementation((url) => url === "/assessments/overview" ? Promise.resolve({ data: { summary: { assessments: 3, activeAssessments: 2, totalCandidates: 5, submitted: 3, inProgress: 2, averageScore: 7.8 }, candidates: [{ _id: "c1", candidateName: "Priya Singh", candidateEmail: "priya@example.com", status: "submitted", overallScore: 8.4, startedAt: "2026-08-10T10:00:00Z", submittedAt: "2026-08-10T11:00:00Z", assessment: { _id: "a1", title: "Senior backend screen", jobRole: "Backend Engineer" } }], totalPages: 1 } }) : Promise.resolve({ data: { items: [], totalPages: 1 } }));
        renderAssessments("/hire/assessments");
        expect(await screen.findByRole("heading", { name: "Hiring overview" })).toBeTruthy();
        expect(await screen.findByText("Priya Singh")).toBeTruthy();
        expect(screen.getByText("Senior backend screen")).toBeTruthy();
        expect(screen.getByRole("link", { name: "Review" }).getAttribute("href")).toBe("/assessments/a1");
        expect(screen.getByText("3 submitted")).toBeTruthy();
    });

    it("describes conversational Hire as adaptive with a maximum question budget and 0-3 follow-ups", async () => {
        get.mockResolvedValue({ data: { items: [], totalPages: 1 } });
        renderAssessments("/hire/assessments?create=1");
        await screen.findByRole("heading", { name: "Create assessment" });
        expect(screen.getByLabelText("Maximum questions").value).toBe("3");
        expect(screen.getByText(/Required recruiter questions are always asked/)).toBeTruthy();
        expect(screen.getByText("0–3 follow-ups per question")).toBeTruthy();
        expect(screen.getByText(/may ask 0–3 follow-ups per question/)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Add manual question" }));
        expect(screen.getByText("Required recruiter question")).toBeTruthy();
        expect(screen.getByText(/1 configured · 0 required|1 configured · 1 required/)).toBeTruthy();
    });

    it("supports a reviewed hybrid question set before publishing", async () => {
        get.mockResolvedValue({ data: { items: [], totalPages: 1 } });
        post.mockImplementation((url) => {
            if (url.endsWith("/generate")) return Promise.resolve({ data: { questions: [{ text: "Explain how you diagnose a slow React render." }, { text: "How do you test keyboard accessibility?" }] } });
            if (url.endsWith("/improve")) return Promise.resolve({ data: { text: "Describe a specific React performance issue you diagnosed and how you measured the result." } });
            return Promise.resolve({ data: { _id: "created" } });
        });
        renderAssessments("/hire/assessments?create=1");
        await screen.findByRole("heading", { name: "Create assessment" });
        fireEvent.change(screen.getByLabelText(/Assessment name/), { target: { value: "Frontend screen" } });
        fireEvent.change(screen.getByLabelText(/Job role/), { target: { value: "Senior frontend engineer" } });
        fireEvent.change(screen.getByLabelText(/Job description and success criteria/), { target: { value: "Own React architecture, accessibility, testing, and web performance." } });
        fireEvent.mouseDown(screen.getByLabelText("Candidate experience"));
        fireEvent.click(await screen.findByRole("option", { name: "Coding / written assessment — all questions" }));
        fireEvent.change(screen.getByLabelText("AI question brief"), { target: { value: "Generate 3 questions about React and accessibility" } });
        fireEvent.click(screen.getByRole("button", { name: "Generate with AI" }));
        expect(await screen.findByDisplayValue("Explain how you diagnose a slow React render.")).toBeTruthy();
        expect(post).toHaveBeenCalledWith("/assessments/questions/generate", expect.objectContaining({ count: 3, deliveryMode: "online-assessment" }));
        fireEvent.click(screen.getByRole("button", { name: "Improve question 1 with AI" }));
        expect(await screen.findByDisplayValue("Describe a specific React performance issue you diagnosed and how you measured the result.")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Add manual question" }));
        fireEvent.change(screen.getByLabelText(/Question 3/), { target: { value: "Review this component API and identify its accessibility risks." } });
        fireEvent.click(screen.getByLabelText(/Invite-only access/));
        fireEvent.change(screen.getByLabelText(/Candidate email addresses/), { target: { value: "one@example.com, two@example.com" } });
        fireEvent.click(screen.getByLabelText("Enable integrity event tracking with candidate consent"));
        fireEvent.click(screen.getByLabelText("Require camera readiness"));
        expect(screen.getByLabelText("Monitor face presence during interview").checked).toBe(true);
        fireEvent.click(screen.getByRole("button", { name: "Publish now" }));
        await vi.waitFor(() => expect(post).toHaveBeenCalledWith("/assessments", expect.objectContaining({ status: "active", integrity: expect.objectContaining({ requireCamera: true, monitorFacePresence: true }), rounds: [expect.objectContaining({ deliveryMode: "online-assessment", questionCount: 3, questions: [
            expect.objectContaining({ text: "Describe a specific React performance issue you diagnosed and how you measured the result.", weight: 1, required: false }),
            expect.objectContaining({ text: "How do you test keyboard accessibility?", weight: 1, required: false }),
            expect.objectContaining({ text: "Review this component API and identify its accessibility risks.", weight: 1, required: true }),
        ] })] })));
        await vi.waitFor(() => expect(post).toHaveBeenCalledWith("/assessments/created/invitations", { candidates: [{ email: "one@example.com" }, { email: "two@example.com" }] }));
    }, 15000);

    it("defaults system-design rounds to one clearly labelled question", async () => {
        get.mockResolvedValue({ data: { items: [], totalPages: 1 } });
        renderAssessments("/hire/assessments?create=1");
        await screen.findByRole("heading", { name: "Create assessment" });
        expect((await screen.findByLabelText("Maximum questions")).value).toBe("3");
        fireEvent.mouseDown(await screen.findByLabelText("Candidate experience"));
        fireEvent.click(await screen.findByRole("option", { name: "System design — canvas + discussion" }));
        expect(screen.getByLabelText("Question count").value).toBe("1");
        expect(screen.getByText(/Excalidraw architecture canvas/)).toBeTruthy();
    });
});
