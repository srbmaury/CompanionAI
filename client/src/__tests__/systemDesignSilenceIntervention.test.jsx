import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import api from "../api/axios";
import { useSystemDesignDiscussion } from "../hooks/useSystemDesignDiscussion";

vi.mock("../api/axios", () => ({
    default: { post: vi.fn() },
}));

const Harness = ({ onInterjection }) => {
    useSystemDesignDiscussion({
        enabled: true,
        endpoint: "/system-design/checkpoint",
        transcript: "",
        diagramData: "",
        intervalMs: 7000,
        onInterjection,
    });
    return null;
};

describe("system design silence intervention", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        api.post.mockReset();
        api.post.mockResolvedValue({
            data: {
                shouldInterrupt: true,
                interjection: "Let's get started—what requirements would you clarify first?",
                kind: "clarify",
            },
        });
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it("forces the interviewer to step in after 15 seconds of candidate silence", async () => {
        const onInterjection = vi.fn();
        render(<Harness onInterjection={onInterjection} />);

        await act(async () => {
            vi.advanceTimersByTime(14999);
            await Promise.resolve();
        });
        expect(api.post).not.toHaveBeenCalled();

        await act(async () => {
            vi.advanceTimersByTime(1);
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(api.post).toHaveBeenCalledTimes(1);
        expect(api.post.mock.calls[0][1]).toMatchObject({ forceInteraction: true });
        expect(onInterjection).toHaveBeenCalledTimes(1);
    });
});
