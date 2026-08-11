import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CandidateAssessmentPage from "../pages/CandidateAssessmentPage";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../api/axios", () => ({ default: { get, post: vi.fn(), put: vi.fn() } }));

afterEach(() => { cleanup(); sessionStorage.clear(); vi.clearAllMocks(); });

describe("candidate assessment privacy UX", () => {
    it("shows expectations and consent without rendering private report fields", async () => {
        get.mockResolvedValue({ data: {
            title: "Backend screen", company: "Acme", jobRole: "Backend Engineer",
            durationMinutes: 45, followUpsEnabled: false, contactEmail: "help@example.com",
            rounds: [{ name: "Technical", description: "", questionCount: 2 }],
            overallScore: 9, feedbackComment: "This must never render",
        } });
        render(<MemoryRouter initialEntries={["/assessment/share-token-123456789"]}><Routes><Route path="/assessment/:shareToken" element={<CandidateAssessmentPage />} /></Routes></MemoryRouter>);
        expect(await screen.findByRole("heading", { name: "Backend screen" })).toBeTruthy();
        expect(screen.getByText(/2 questions · about 45 minutes/i)).toBeTruthy();
        expect(screen.getByText(/help@example.com/i)).toBeTruthy();
        expect(screen.queryByText("9/10")).toBeNull();
        expect(screen.queryByText("This must never render")).toBeNull();
        const start = screen.getByRole("button", { name: "Start assessment" });
        expect(start.disabled).toBe(true);
        fireEvent.click(screen.getByRole("checkbox"));
        await waitFor(() => expect(start.disabled).toBe(false));
    });
});
