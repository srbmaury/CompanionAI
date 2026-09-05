import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CandidateAssessmentPage from "../pages/CandidateAssessmentPage";

const { get, post, put } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("../api/axios", () => ({ default: { get, post, put } }));

afterEach(() => { cleanup(); sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks(); });

const renderCandidate = () => render(<MemoryRouter initialEntries={["/assessment/share-token-123456789"]}><Routes><Route path="/assessment/:shareToken" element={<CandidateAssessmentPage />} /></Routes></MemoryRouter>);

describe("candidate assessment privacy UX", () => {
    it("shows expectations and consent without rendering private report fields", async () => {
        get.mockResolvedValue({ data: {
            title: "Backend screen", company: "Acme", jobRole: "Backend Engineer",
            durationMinutes: 45, followUpsEnabled: false, contactEmail: "help@example.com",
            rounds: [{ name: "Technical", description: "", questionCount: 2 }],
            overallScore: 9, feedbackComment: "This must never render",
        } });
        renderCandidate();
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
        renderCandidate();
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
        renderCandidate();
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

    it("stays on the same primary question while AI asks follow-up two", async () => {
        get.mockResolvedValue({ data: {
            title: "Adaptive backend screen", jobRole: "Backend Engineer", durationMinutes: 30, followUpsEnabled: true,
            capabilities: { transcription: false, codeExecution: false },
            rounds: [{ name: "Technical", description: "Backend judgment", questionCount: 3 }],
        } });
        const baseAttempt = {
            _id: "attempt",
            rounds: [{ _id: "round", name: "Technical", description: "Backend judgment", deliveryMode: "conversational", adaptive: true, questions: [{ _id: "q1", text: "How would you make an API resilient?", answer: "", followUps: [], followUpQuestion: "", followUpAnswer: "", followUpNumber: 0, remainingFollowUps: 3 }] }],
        };
        post.mockResolvedValue({ data: { attemptToken: "token", attempt: baseAttempt } });
        put
            .mockResolvedValueOnce({ data: { attempt: { ...baseAttempt, rounds: [{ ...baseAttempt.rounds[0], questions: [{ ...baseAttempt.rounds[0].questions[0], answer: "Use timeouts, retries, and idempotency.", followUps: [{ question: "How would you prevent retry storms?", answer: "" }], followUpQuestion: "How would you prevent retry storms?", followUpAnswer: "", followUpNumber: 1, remainingFollowUps: 2 }] }] } } })
            .mockResolvedValueOnce({ data: { attempt: { ...baseAttempt, rounds: [{ ...baseAttempt.rounds[0], questions: [{ ...baseAttempt.rounds[0].questions[0], answer: "Use timeouts, retries, and idempotency.", followUps: [{ question: "How would you prevent retry storms?", answer: "Backoff, jitter, retry budgets, and circuit breaking." }, { question: "How would you measure whether that policy is working?", answer: "" }], followUpQuestion: "How would you measure whether that policy is working?", followUpAnswer: "", followUpNumber: 2, remainingFollowUps: 1 }] }] } } });

        renderCandidate();
        fireEvent.change(await screen.findByLabelText(/Full name/), { target: { value: "Candidate" } });
        fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: "candidate@example.com" } });
        fireEvent.click(screen.getByRole("checkbox"));
        fireEvent.click(screen.getByRole("button", { name: "Start assessment" }));

        const answer = await screen.findByPlaceholderText("Answer by typing or speaking...");
        fireEvent.change(answer, { target: { value: "Use timeouts, retries, and idempotency." } });
        fireEvent.click(screen.getByRole("button", { name: "Save answer and continue interview" }));
        expect(await screen.findByText("How would you prevent retry storms?")).toBeTruthy();
        expect(screen.getByText("Follow-up 1 of up to 3")).toBeTruthy();

        fireEvent.change(screen.getByLabelText("Your follow-up answer"), { target: { value: "Backoff, jitter, retry budgets, and circuit breaking." } });
        fireEvent.click(screen.getByRole("button", { name: "Save follow-up and continue interview" }));

        expect(await screen.findByText("How would you measure whether that policy is working?")).toBeTruthy();
        expect(screen.getByText("Follow-up 2 of up to 3")).toBeTruthy();
        expect(screen.getByRole("heading", { name: "How would you make an API resilient?" })).toBeTruthy();
        expect(put).toHaveBeenCalledTimes(2);
    });
});
