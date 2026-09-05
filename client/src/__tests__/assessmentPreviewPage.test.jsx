import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AssessmentPreviewPage from "../pages/AssessmentPreviewPage";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../api/axios", () => ({ default: { get } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("assessment candidate preview", () => {
    it("shows candidate-facing setup and allows reviewing every question without starting an attempt", async () => {
        get.mockResolvedValue({ data: { title: "Backend screen", company: "Acme", jobRole: "Backend Engineer", durationMinutes: 30, inviteOnly: true, followUpsEnabled: true, candidateInstructions: "Use a quiet room.", integrity: { enabled: true, requireCamera: true, requireFullscreen: true }, rounds: [{ name: "Technical", deliveryMode: "conversational", questions: [{ text: "Design an API." }, { text: "Secure the API." }] }] } });
        render(<MemoryRouter initialEntries={["/hire/assessments/a1/preview"]}><Routes><Route path="/hire/assessments/:assessmentId/preview" element={<AssessmentPreviewPage />} /></Routes></MemoryRouter>);

        expect(await screen.findByRole("heading", { name: "Backend screen" })).toBeTruthy();
        expect(screen.getByText(/Nothing entered here is saved/)).toBeTruthy();
        expect(screen.getByText("Camera required")).toBeTruthy();
        expect(screen.getByRole("heading", { name: "Design an API." })).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Next question" }));
        expect(screen.getByRole("heading", { name: "Secure the API." })).toBeTruthy();
        expect(get).toHaveBeenCalledWith("/assessments/a1/preview");
    });
});
