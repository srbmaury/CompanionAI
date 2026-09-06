import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SystemDesignDiscussionPanel from "../components/SystemDesignDiscussionPanel";
import { countDiscussionWords } from "../utils/systemDesignDiscussion";

vi.mock("../hooks/useSystemDesignDiscussion", () => ({
    useSystemDesignDiscussion: () => ({ interjections: [], checking: false, checkpoint: vi.fn() }),
}));

vi.mock("../components/SystemDesignCanvas", () => ({
    default: () => <div data-testid="system-design-canvas">Canvas</div>,
}));

afterEach(() => cleanup());

const baseProps = {
    problem: "Design a URL shortening service like Bitly.",
    onTranscriptChange: vi.fn(),
    diagramData: "",
    onDiagramChange: vi.fn(),
    target: "system-design",
    checkpointEndpoint: "/checkpoint",
    supportsSTT: false,
    supportsTTS: false,
    listening: false,
    listeningTarget: null,
    micSessionActive: false,
    handsFreePaused: false,
    startHandsFree: vi.fn(),
    pauseHandsFree: vi.fn(),
    resumeHandsFree: vi.fn(),
    stopHandsFree: vi.fn(),
    speakNow: vi.fn(),
    onEnd: vi.fn(),
};

describe("SystemDesignDiscussionPanel", () => {
    it("counts meaningful discussion words", () => {
        expect(countDiscussionWords("  design   a scalable service now ")).toBe(5);
        expect(countDiscussionWords("   ")).toBe(0);
    });

    it("keeps End discussion disabled until the candidate has explained at least 30 words", () => {
        const shortTranscript = "I would start by clarifying requirements and then identify the main APIs, storage needs, traffic assumptions, and the critical read and write paths.";
        const { rerender } = render(<SystemDesignDiscussionPanel {...baseProps} transcript={shortTranscript} />);

        expect(screen.getByRole("button", { name: "End discussion" }).disabled).toBe(true);
        expect(screen.getByText(/End discussion unlocks/)).toBeTruthy();

        const longTranscript = Array.from({ length: 30 }, (_, index) => `word${index + 1}`).join(" ");
        rerender(<SystemDesignDiscussionPanel {...baseProps} transcript={longTranscript} />);

        expect(screen.getByRole("button", { name: "End discussion" }).disabled).toBe(false);
    });
});
