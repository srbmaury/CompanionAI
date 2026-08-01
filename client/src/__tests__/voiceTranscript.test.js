import { describe, expect, it } from "vitest";
import { composeLiveTranscript } from "../hooks/useVoiceInput";

describe("voice transcript composition", () => {
    it("keeps the unfinished interim phrase when recording stops", () => {
        expect(composeLiveTranscript("The final part", "and the words still being recognized")).toBe(
            "The final part and the words still being recognized",
        );
    });

    it("handles browsers that only provide interim speech", () => {
        expect(composeLiveTranscript("", "populate this answer")).toBe("populate this answer");
    });
});
