import { describe, expect, it } from "vitest";
import {
    chooseInterviewerGender,
    interviewerPitchForGender,
    selectInterviewerVoice,
} from "../utils/interviewerVoice";

describe("interviewer voice selection", () => {
    it("supports deterministic random gender selection", () => {
        expect(chooseInterviewerGender(() => 0.1)).toBe("female");
        expect(chooseInterviewerGender(() => 0.9)).toBe("male");
    });

    it("prefers an English voice matching the selected gender", () => {
        const voices = [
            { name: "Samantha", voiceURI: "samantha", lang: "en-US" },
            { name: "Daniel", voiceURI: "daniel", lang: "en-GB" },
            { name: "Amelie", voiceURI: "amelie", lang: "fr-FR" },
        ];
        expect(selectInterviewerVoice(voices, "female")?.name).toBe("Samantha");
        expect(selectInterviewerVoice(voices, "male")?.name).toBe("Daniel");
    });

    it("uses a subtle pitch fallback when the browser has limited voices", () => {
        expect(interviewerPitchForGender("female")).toBeGreaterThan(1);
        expect(interviewerPitchForGender("male")).toBeLessThan(1);
    });
});
