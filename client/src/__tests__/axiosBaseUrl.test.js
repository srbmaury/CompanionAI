import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "../api/axios";

describe("resolveApiBaseUrl", () => {
    it("uses the same-origin Vite proxy during local development", () => {
        expect(resolveApiBaseUrl("http://localhost:5000/api", "localhost")).toBe("/api");
        expect(resolveApiBaseUrl("http://127.0.0.1:5000/api", "127.0.0.1")).toBe("/api");
    });

    it("keeps the configured production API origin", () => {
        expect(resolveApiBaseUrl("https://api.evalcue.example/api", "evalcue.example")).toBe("https://api.evalcue.example/api");
    });
});
