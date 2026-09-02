import { describe, expect, it } from "vitest";
import { isValidSystemDesignDiagram, summarizeSystemDesignDiagram } from "../../utils/systemDesignDiagram.js";

describe("system-design diagram utilities", () => {
    it("creates compact AI context without sending raw scene JSON", () => {
        const scene = JSON.stringify({ elements: [
            { id: "api", type: "rectangle", boundElements: [{ id: "api-label", type: "text" }] },
            { id: "api-label", type: "text", containerId: "api", text: "API Gateway" },
            { id: "flow", type: "arrow", startBinding: { elementId: "api" }, endBinding: { elementId: "db" } },
            { id: "db", type: "rectangle", boundElements: [{ id: "db-label", type: "text" }] },
            { id: "db-label", type: "text", containerId: "db", text: "Orders DB" },
        ] });
        expect(summarizeSystemDesignDiagram(scene)).toContain("2 rectangle");
        expect(summarizeSystemDesignDiagram(scene)).toContain("API Gateway; Orders DB");
        expect(summarizeSystemDesignDiagram(scene)).toContain("API Gateway -> Orders DB");
        expect(summarizeSystemDesignDiagram(scene)).toContain("infer semantics cautiously");
        expect(isValidSystemDesignDiagram(scene)).toBe(true);
    });

    it("rejects malformed and excessively complex scenes", () => {
        expect(isValidSystemDesignDiagram("not json")).toBe(false);
        expect(isValidSystemDesignDiagram(JSON.stringify({ elements: Array.from({ length: 1001 }, () => ({})) }))).toBe(false);
    });
});
