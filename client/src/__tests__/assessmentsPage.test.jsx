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
        await vi.waitFor(() => expect(screen.queryByRole("heading", { name: "Assessments" })).toBeNull());
        expect(screen.queryByRole("heading", { name: "Candidate pipeline" })).toBeNull();
    });

    it("gives recruiters a cross-assessment candidate pipeline", async () => {
        get.mockImplementation((url) => url === "/assessments/overview" ? Promise.resolve({ data: { summary: { assessments: 3, activeAssessments: 2, totalCandidates: 5, submitted: 3, inProgress: 2, averageScore: 7.8 }, candidates: [{ _id: "c1", candidateName: "Priya Singh", candidateEmail: "priya@example.com", status: "submitted", overallScore: 8.4, startedAt: "2026-08-10T10:00:00Z", submittedAt: "2026-08-10T11:00:00Z", assessment: { _id: "a1", title: "Senior backend screen", jobRole: "Backend Engineer" } }], totalPages: 1 } }) : Promise.resolve({ data: { items: [], totalPages: 1 } }));
        renderAssessments("/hire/assessments");
        expect(await screen.findByRole("heading", { name: "Overview" })).toBeTruthy();
        expect(await screen.findByText("Priya Singh")).toBeTruthy();
        expect(screen.getByText("Senior backend screen")).toBeTruthy();
        expect(screen.getByRole("link", { name: "Review" }).getAttribute("href")).toBe("/hire/assessments/a1");
        expect(screen.getByText("3 submitted")).toBeTruthy();
    });

    it("lets recruiters choose must-ask questions, adaptive primary questions, or a fixed reviewed set independently of follow-ups", async () => {
        get.mockResolvedValue({ data: { items: [], totalPages: 1 } });
        renderAssessments("/hire/assessments?create=1");
        await screen.findByRole("heading", { name: "Create assessment" });
        expect(screen.getByLabelText(/Maximum questions/).value).toBe("3");
        const aiQuestionToggle = screen.getByLabelText(/Allow AI to generate additional interview questions/);
        expect(aiQuestionToggle.checked).toBe(true);
        expect(screen.getByText("Adaptive primary questions")).toBeTruthy();
        expect(screen.getByText("0–3 follow-ups per question")).toBeTruthy();
        expect(screen.getByText(/may ask 0–3 follow-ups per primary question/)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Add manual question" }));
        fireEvent.change(screen.getByLabelText(/Question 1/), { target: { value: "Explain a reliability decision you made and the trade-off." } });
        expect(screen.getByText("Must-ask recruiter question")).toBeTruthy();
        const mustAsk = screen.getByRole("checkbox", { name: /Must ask this question/ });
        expect(mustAsk.checked).toBe(true);
        expect(screen.getByText("1 configured · 1 must ask · up to 3 total")).toBeTruthy();
        fireEvent.click(mustAsk);
        expect(mustAsk.checked).toBe(false);
        expect(screen.getByText("Optional AI-planned question")).toBeTruthy();
        expect(screen.getByText("1 configured · 0 must ask · up to 3 total")).toBeTruthy();
        fireEvent.click(aiQuestionToggle);
        expect(screen.getByLabelText(/Question count/).disabled).toBe(true);
        expect(screen.getByLabelText(/Question count/).value).toBe("1");
        expect(screen.getByText("Recruiter question set only")).toBeTruthy();
        expect(screen.getByText("Fixed interview question")).toBeTruthy();
        expect(screen.getByText("1 configured · fixed interview set")).toBeTruthy();
        expect(screen.getByRole("checkbox", { name: /^AI contextual follow-ups/ }).checked).toBe(true);
    });

    it("keeps advanced scoring controls collapsed by default", async () => {
        get.mockResolvedValue({ data: { items: [], totalPages: 1 } });
        renderAssessments("/hire/assessments?create=1");
        await screen.findByRole("heading", { name: "Create assessment" });
        fireEvent.click(screen.getByRole("button", { name: "Add manual question" }));
        fireEvent.change(screen.getByLabelText(/Question 1/), { target: { value: "Explain how you would investigate a production reliability regression." } });
        const advanced = screen.getByText("Advanced scoring and review").closest("details");
        expect(advanced?.open).toBe(false);
        expect(screen.getByText("Advanced scoring and review")).toBeTruthy();
    });

    it("supports a reviewed hybrid question set before publishing", async () => {
        get.mockResolvedValue({ data: { items: [], totalPages: 1 } });
        post.mockImplementation((url) => {
            if (url.endsWith("/generate")) return Promise.resolve({ data: { questions: [{ text: "Explain how you diagnose a slow React render." }, { text: "How do you test keyboard accessibility?" }] } });
            if (url.endsWith("/improve")) return Promise.resolve({ data: { text: "Describe a specific React performance issue you diagnosed and how you measured the result." } });
            return Promise.resolve({ data: {} });
        });
        renderAssessments("/hire/assessments?create=1");
        await screen.findByRole("heading", { name: "Create assessment" });
        fireEvent.change(screen.getByLabelText("Job role"), { target: { value: "Frontend Engineer" } });
        fireEvent.change(screen.getByLabelText("Job description"), { target: { value: "Build accessible, high-performance React applications and own frontend quality." } });
        fireEvent.change(screen.getByLabelText(/AI question brief/), { target: { value: "Create 2 questions about React performance and accessibility" } });
        fireEvent.click(screen.getByRole("button", { name: /Generate questions/ }));
        expect(await screen.findByDisplayValue("Explain how you diagnose a slow React render.")).toBeTruthy();
        expect(screen.getByDisplayValue("How do you test keyboard accessibility?")).toBeTruthy();
        const improveButtons = screen.getAllByRole("button", { name: /Improve question/ });
        fireEvent.click(improveButtons[0]);
        expect(await screen.findByDisplayValue("Describe a specific React performance issue you diagnosed and how you measured the result.")).toBeTruthy();
    });

    it("defaults system-design rounds to one clearly labelled question", async () => {
        get.mockResolvedValue({ data: { items: [], totalPages: 1 } });
        renderAssessments("/hire/assessments?create=1");
        await screen.findByRole("heading", { name: "Create assessment" });
        fireEvent.mouseDown(screen.getByLabelText("Round type"));
        fireEvent.click(screen.getByRole("option", { name: "System design" }));
        expect(screen.getByLabelText(/Maximum questions/).value).toBe("1");
        expect(screen.getByText(/System design uses one primary problem/)).toBeTruthy();
    });
});