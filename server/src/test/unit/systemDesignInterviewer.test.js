import { describe, expect, it } from "vitest";
import { generateSystemDesignInterjection } from "../../services/systemDesignInterviewer.js";

describe("system design interviewer", () => {
    it("still intervenes when a forced checkpoint has no candidate transcript yet", async () => {
        const result = await generateSystemDesignInterjection({
            problem: "Design a URL shortening service like Bitly.",
            transcript: "",
            previousInterjections: [],
            forceInteraction: true,
        });

        expect(result.shouldInterrupt).toBe(true);
        expect(result.interjection).toBeTruthy();
        expect(result.kind).toBe("clarify");
    });
});
