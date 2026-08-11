import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AssessmentsPage from "../pages/AssessmentsPage";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../api/axios", () => ({ default: { get, post } }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("assessment workspace hierarchy", () => {
    it("shows existing assessments before keeping creation controls on demand", async () => {
        get.mockResolvedValue({ data: { items: [{ _id: "a1", title: "Backend screen", jobRole: "Engineer", company: "Acme", status: "active", attemptCount: 2, submittedCount: 1, shareToken: "share-token" }], totalPages: 1 } });
        render(<MemoryRouter initialEntries={["/assessments"]}><AssessmentsPage /></MemoryRouter>);
        expect(await screen.findByRole("heading", { name: "Backend screen" })).toBeTruthy();
        expect(screen.queryByRole("heading", { name: "Create assessment" })).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Create assessment" }));
        expect(screen.getByRole("heading", { name: "Create assessment" })).toBeTruthy();
        expect(screen.getByRole("heading", { name: "Your assessments" }).compareDocumentPosition(screen.getByRole("heading", { name: "Create assessment" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("supports a reviewed hybrid question set before publishing", async () => {
        get.mockResolvedValue({ data: { items: [], totalPages: 1 } });
        post.mockImplementation((url) => {
            if (url.endsWith("/generate")) return Promise.resolve({ data: { questions: [{ text: "Explain how you diagnose a slow React render." }, { text: "How do you test keyboard accessibility?" }] } });
            if (url.endsWith("/improve")) return Promise.resolve({ data: { text: "Describe a specific React performance issue you diagnosed and how you measured the result." } });
            return Promise.resolve({ data: { _id: "created" } });
        });
        render(<MemoryRouter initialEntries={["/assessments?create=1"]}><AssessmentsPage /></MemoryRouter>);
        await screen.findByText("No assessments yet.");
        fireEvent.change(screen.getByLabelText(/Assessment title/), { target: { value: "Frontend screen" } });
        fireEvent.change(screen.getByLabelText(/Job role/), { target: { value: "Senior frontend engineer" } });
        fireEvent.change(screen.getByLabelText(/Job description and success criteria/), { target: { value: "Own React architecture, accessibility, testing, and web performance." } });
        fireEvent.change(screen.getByLabelText("Tell AI what to generate"), { target: { value: "Generate 3 questions about React and accessibility" } });
        fireEvent.click(screen.getByRole("button", { name: "Generate with AI" }));
        expect(await screen.findByDisplayValue("Explain how you diagnose a slow React render.")).toBeTruthy();
        expect(post).toHaveBeenCalledWith("/assessments/questions/generate", expect.objectContaining({ count: 3 }));
        fireEvent.click(screen.getByRole("button", { name: "Improve question 1 with AI" }));
        expect(await screen.findByDisplayValue("Describe a specific React performance issue you diagnosed and how you measured the result.")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Add manual question" }));
        fireEvent.change(screen.getByLabelText(/Question 3/), { target: { value: "Review this component API and identify its accessibility risks." } });
        fireEvent.click(screen.getByRole("button", { name: "Create and publish assessment" }));
        await vi.waitFor(() => expect(post).toHaveBeenCalledWith("/assessments", expect.objectContaining({ rounds: [expect.objectContaining({ questionCount: 3, questions: [
            { text: "Describe a specific React performance issue you diagnosed and how you measured the result." },
            { text: "How do you test keyboard accessibility?" },
            { text: "Review this component API and identify its accessibility risks." },
        ] })] })));
    });
});
