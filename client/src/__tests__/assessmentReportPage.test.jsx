import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AssessmentReportPage from "../pages/AssessmentReportPage";
import { NotificationProvider } from "../context/NotificationContext";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../api/axios", () => ({ default: { get, post, patch: vi.fn(), delete: vi.fn() } }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("assessment management report", () => {
    it("renders management, invitations, scorecard, and candidate evidence without crashing", async () => {
        get.mockResolvedValue({ data: {
            assessment: { _id: "a1", title: "Backend screen", status: "active", jobRole: "Backend Engineer", company: "Acme", shareToken: "share", invitations: [{ _id: "i1", email: "candidate@example.com", status: "completed" }], rubric: [{ _id: "r1", name: "Technical judgment", weight: 2 }] },
            attempts: [{ _id: "c1", candidateName: "Candidate One", candidateEmail: "candidate@example.com", status: "submitted", startedAt: "2026-08-10T10:00:00Z", overallScore: 8, integrityEvents: [{ type: "tab_hidden" }], rounds: [{ _id: "round1", name: "Technical", score: 8, questions: [{ _id: "q1", text: "Design a secure API", answer: "Use scoped authentication.", score: 8, feedbackComment: "Good evidence", suggestions: [] }] }] }],
        } });
        render(<NotificationProvider><MemoryRouter initialEntries={["/assessments/a1"]}><Routes><Route path="/assessments/:assessmentId" element={<AssessmentReportPage />} /></Routes></MemoryRouter></NotificationProvider>);
        expect(await screen.findByRole("heading", { name: "Backend screen" })).toBeTruthy();
        expect(screen.getByRole("heading", { name: "Invite candidates" })).toBeTruthy();
        expect(screen.getByRole("heading", { name: "Shared scorecard" })).toBeTruthy();
        expect(screen.getByText(/Integrity review/)).toBeTruthy();
        expect(screen.getByText("Human scorecard")).toBeTruthy();
    });

    it("confirms version creation and redirects to the new assessment", async () => {
        get.mockResolvedValue({ data: { assessment: { _id: "a1", title: "Backend screen", status: "active", jobRole: "Engineer", shareToken: "share", invitations: [], rubric: [] }, attempts: [] } });
        post.mockResolvedValue({ data: { _id: "a2", title: "Backend screen · v2" } });
        render(<NotificationProvider><MemoryRouter initialEntries={["/assessments/a1"]}><Routes><Route path="/assessments/:assessmentId" element={<AssessmentReportPage />} /></Routes></MemoryRouter></NotificationProvider>);
        fireEvent.click(await screen.findByRole("button", { name: "Create new version" }));
        await waitFor(() => expect(post).toHaveBeenCalledWith("/assessments/a1/duplicate", {}));
        expect(await screen.findByText("New version “Backend screen · v2” created successfully.")).toBeTruthy();
        await waitFor(() => expect(get).toHaveBeenCalledWith("/assessments/a2"));
    });
});
