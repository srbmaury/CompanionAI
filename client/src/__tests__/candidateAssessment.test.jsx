import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CandidateAssessmentPage from "../pages/CandidateAssessmentPage";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../api/axios", () => ({ default: { get, post, put: vi.fn() } }));

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

    it("discloses local face monitoring before requiring integrity consent", async () => {
        get.mockResolvedValue({ data: {
            title: "Monitored screen", jobRole: "Engineer", durationMinutes: 30, followUpsEnabled: false,
            integrity: { enabled: true, requireCamera: true, monitorFacePresence: true, retentionDays: 14 },
            rounds: [{ name: "Technical", description: "", questionCount: 1 }],
        } });
        render(<MemoryRouter initialEntries={["/assessment/share-token-123456789"]}><Routes><Route path="/assessment/:shareToken" element={<CandidateAssessmentPage />} /></Routes></MemoryRouter>);
        expect(await screen.findByText(/camera frames stay in your browser and are not saved or uploaded/i)).toBeTruthy();
        expect(screen.getByText(/sustained face-presence/i)).toBeTruthy();
        expect(screen.getByRole("button", { name: "Check camera" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Start assessment" }).disabled).toBe(true);
    });

    it("requests fullscreen from the start button user gesture", async () => {
        const requestFullscreen = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: requestFullscreen });
        get.mockResolvedValue({ data: { title: "Fullscreen screen", jobRole: "Engineer", durationMinutes: 30, followUpsEnabled: false, integrity: { enabled: true, requireFullscreen: true, requireCamera: false, retentionDays: 14 }, rounds: [{ name: "Technical", questionCount: 1 }] } });
        post.mockResolvedValue({ data: { attemptToken: "token", attempt: { _id: "attempt", rounds: [{ _id: "round", name: "Technical", questions: [{ _id: "question", text: "Explain your approach", answer: "" }] }] } } });
        render(<MemoryRouter initialEntries={["/assessment/share-token-123456789"]}><Routes><Route path="/assessment/:shareToken" element={<CandidateAssessmentPage />} /></Routes></MemoryRouter>);
        fireEvent.change(await screen.findByLabelText(/Full name/), { target: { value: "Candidate" } });
        fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: "candidate@example.com" } });
        const consentBoxes = screen.getAllByRole("checkbox");
        fireEvent.click(consentBoxes[0]);
        fireEvent.click(consentBoxes[1]);
        fireEvent.click(screen.getByRole("button", { name: "Start assessment" }));
        expect(requestFullscreen).toHaveBeenCalledOnce();
        await waitFor(() => expect(post).toHaveBeenCalled());
        delete document.documentElement.requestFullscreen;
    });
});
