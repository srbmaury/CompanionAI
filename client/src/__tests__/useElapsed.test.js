import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useElapsed } from "../hooks/useElapsed";

describe("useElapsed", () => {
    afterEach(() => vi.useRealTimers());

    it("returns 00:00 immediately", () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useElapsed());
        expect(result.current).toBe("00:00");
    });

    it("increments every second", () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useElapsed());
        act(() => { vi.advanceTimersByTime(3000); });
        expect(result.current).toBe("00:03");
    });

    it("formats minutes correctly", () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useElapsed());
        act(() => { vi.advanceTimersByTime(90000); }); // 1m 30s
        expect(result.current).toBe("01:30");
    });
});
