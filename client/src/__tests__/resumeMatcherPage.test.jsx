import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ResumeMatcherPage from "../pages/ResumeMatcherPage";
import { NotificationProvider } from "../context/NotificationContext";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("../api/axios", () => ({ default: { post } }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("best resume matcher", () => {
    it("ranks owned resumes and highlights the best match", async () => {
        post.mockImplementation((url) => url === "/resumes/match" ? Promise.resolve({ data: {
            resumeCount: 2,
            methodology: "Explainable coverage.",
            matches: [
                { resumeId: "one", fileName: "frontend.pdf", score: 84, matchedKeywords: ["react", "testing"], missingKeywords: ["graphql"], evidence: ["Built React applications with automated testing."] },
                { resumeId: "two", fileName: "backend.pdf", score: 31, matchedKeywords: ["testing"], missingKeywords: ["react"], evidence: [] },
            ],
        } }) : Promise.resolve({ data: { accepted: true } }));
        render(<MemoryRouter><NotificationProvider><ResumeMatcherPage /></NotificationProvider></MemoryRouter>);

        fireEvent.change(screen.getByRole("textbox", { name: /Job description/ }), { target: { value: "Build accessible React applications with automated testing, GraphQL, and performance optimization." } });
        fireEvent.click(screen.getByRole("button", { name: "Find best resume" }));

        await waitFor(() => expect(post).toHaveBeenCalledWith("/resumes/match", expect.objectContaining({ jobDescription: expect.stringContaining("React applications") })));
        expect(await screen.findByText("Best match")).toBeTruthy();
        expect(screen.getByText("84% match")).toBeTruthy();
        expect(screen.getByText("Built React applications with automated testing.")).toBeTruthy();
    });
});
