import { describe, expect, it } from "vitest";
import { composeAnswerParts } from "../utils/answerParts";

describe("answer part composition", () => {
    it("keeps code and spoken explanation clearly separated for submission", () => {
        expect(composeAnswerParts("return left + right;", "I use divide and conquer.")).toBe(
            "Written/code answer:\nreturn left + right;\n\nSpoken explanation:\nI use divide and conquer.",
        );
    });

    it("does not add labels when only one input is present", () => {
        expect(composeAnswerParts("const result = 1;", "")).toBe("const result = 1;");
        expect(composeAnswerParts("", "My verbal answer")).toBe("My verbal answer");
    });
});
