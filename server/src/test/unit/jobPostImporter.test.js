import { describe, expect, it } from "vitest";
import { extractJobPost, validatePublicJobUrl } from "../../services/jobPostImporter.js";

describe("job-post importer", () => {
    it("extracts structured JobPosting data", () => {
        const result = extractJobPost(`
            <html><script type="application/ld+json">{
                "@context":"https://schema.org",
                "@type":"JobPosting",
                "title":"Senior Platform Engineer",
                "description":"<p>Build reliable distributed systems and mentor engineers across the platform team.</p>",
                "hiringOrganization":{"@type":"Organization","name":"Acme"}
            }</script></html>
        `, "https://jobs.example.com/42");

        expect(result).toMatchObject({
            company: "Acme",
            jobRole: "Senior Platform Engineer",
            jobDescription: "Build reliable distributed systems and mentor engineers across the platform team.",
            sourceUrl: "https://jobs.example.com/42",
        });
    });

    it("falls back to page metadata", () => {
        const result = extractJobPost(`
            <html><head>
                <meta property="og:site_name" content="Example Careers">
                <meta property="og:title" content="Frontend Engineer">
                <meta name="description" content="Own accessible React experiences, performance, testing, and delivery.">
            </head></html>
        `, "https://example.com/jobs/frontend");

        expect(result.company).toBe("Example Careers");
        expect(result.jobRole).toBe("Frontend Engineer");
        expect(result.jobDescription).toContain("accessible React experiences");
    });

    it("rejects pages without enough useful job content", () => {
        expect(() => extractJobPost("<title>Careers</title><main>Short</main>", "https://example.com/jobs"))
            .toThrow("couldn’t extract enough job details");
    });

    it("rejects loopback targets before making a request", async () => {
        await expect(validatePublicJobUrl("http://127.0.0.1/internal"))
            .rejects.toThrow("Private network URLs are not allowed");
        await expect(validatePublicJobUrl("http://[::ffff:127.0.0.1]/internal"))
            .rejects.toThrow("Private network URLs are not allowed");
    });
});
