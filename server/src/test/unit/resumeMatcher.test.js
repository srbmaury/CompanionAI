import { describe, expect, it } from "vitest";
import { rankResumesForJob } from "../../services/resumeMatcher.js";

describe("resume-to-job matcher", () => {
    const resumes = [
        { _id: "frontend", fileName: "frontend.pdf", tags: ["React"], extractedText: "Built accessible React applications with TypeScript, automated testing, and performance optimization." },
        { _id: "backend", fileName: "backend.pdf", tags: ["Java"], extractedText: "Designed Java services, relational databases, and distributed messaging systems." },
    ];

    it("ranks the resume with stronger JD coverage first and explains why", () => {
        const matches = rankResumesForJob(resumes, { role: "Frontend Engineer", jobDescription: "Build accessible React applications using TypeScript, automated testing, and frontend performance optimization." });
        expect(matches[0].resumeId).toBe("frontend");
        expect(matches[0].score).toBeGreaterThan(matches[1].score);
        expect(matches[0].matchedKeywords).toEqual(expect.arrayContaining(["react", "typescript", "testing"]));
        expect(matches[0].evidence[0]).toContain("React applications");
    });

    it("returns stable zero scores when no job keywords match", () => {
        const matches = rankResumesForJob(resumes, { jobDescription: "Marine biology laboratory research and ecological field sampling." });
        expect(matches.every((match) => match.score === 0)).toBe(true);
        expect(matches.every((match) => match.matchedKeywords.length === 0)).toBe(true);
    });
});
