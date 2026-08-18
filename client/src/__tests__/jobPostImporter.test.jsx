import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import JobPostImporter from "../components/JobPostImporter";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("../api/axios", () => ({ default: { post } }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("JobPostImporter", () => {
    it("imports a public job post and populates its parent form", async () => {
        const imported = {
            company: "Acme",
            jobRole: "Platform Engineer",
            jobDescription: "Build reliable platform services for product teams.",
            sourceUrl: "https://jobs.example.com/platform-engineer",
        };
        post.mockResolvedValue({ data: imported });
        const onImport = vi.fn();
        render(<JobPostImporter onImport={onImport} />);

        fireEvent.click(screen.getByRole("button", { name: /Have a job-post link/ }));
        fireEvent.change(screen.getByLabelText("Job post URL"), { target: { value: imported.sourceUrl } });
        fireEvent.click(screen.getByRole("button", { name: "Import details" }));

        await waitFor(() => expect(post).toHaveBeenCalledWith("/job-posts/import", { url: imported.sourceUrl }));
        expect(onImport).toHaveBeenCalledWith(imported);
        expect(screen.getByText(/Review the editable details below/)).toBeTruthy();
    });

    it("keeps manual entry available when extraction fails", async () => {
        post.mockRejectedValue({ response: { data: { message: "We couldn’t extract enough job details from this page. Enter them manually instead." } } });
        render(<JobPostImporter />);

        fireEvent.click(screen.getByRole("button", { name: /Have a job-post link/ }));
        fireEvent.change(screen.getByLabelText("Job post URL"), { target: { value: "https://example.com/jobs/1" } });
        fireEvent.click(screen.getByRole("button", { name: "Import details" }));

        expect(await screen.findByText(/Enter them manually instead/)).toBeTruthy();
    });
});
