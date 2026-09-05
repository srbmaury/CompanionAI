import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OAForm from "../components/OAForm";

vi.mock("../components/CodeEditorField", () => ({
    default: ({ value, onChange }) => (
        <textarea
            aria-label="Mock answer editor"
            value={value}
            onChange={(event) => onChange(event.target.value)}
        />
    ),
}));

vi.mock("../components/VoiceControls", () => ({
    default: () => <button type="button">Replay question</button>,
}));

vi.mock("../components/SkipRoundButton", () => ({
    default: () => <button type="button">Skip round</button>,
}));

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("OAForm interview experience", () => {
    it("keeps one question in focus and lets the candidate navigate without losing answers", () => {
        const questions = [
            { question: { text: "Implement an LRU cache." } },
            { question: { text: "Explain the complexity." } },
        ];
        const answers = ["", "Already answered"];
        const onChange = vi.fn();

        render(
            <OAForm
                questions={questions}
                answers={answers}
                spokenAnswers={["", ""]}
                codingEnabled={[true, false]}
                onCodingModeChange={vi.fn()}
                codeDraftPrefix="round-1"
                onSpokenChange={vi.fn()}
                onChange={onChange}
                onSubmit={vi.fn()}
                onSkip={vi.fn()}
                submitting={false}
                supportsTTS
                supportsSTT
                listening={false}
                listeningTarget={null}
                onSpeak={vi.fn()}
                onStartListening={vi.fn()}
                onStopListening={vi.fn()}
            />,
        );

        expect(screen.getByRole("heading", { name: "Implement an LRU cache." })).toBeTruthy();
        expect(screen.queryByRole("heading", { name: "Explain the complexity." })).toBeNull();
        expect(screen.getByText("1/2 answered")).toBeTruthy();

        fireEvent.change(screen.getByLabelText("Mock answer editor"), { target: { value: "class LRU {}" } });
        expect(onChange).toHaveBeenCalledWith(0, "class LRU {}");

        fireEvent.click(screen.getByRole("button", { name: "Next question" }));
        expect(screen.getByRole("heading", { name: "Explain the complexity." })).toBeTruthy();
        expect(screen.getByDisplayValue("Already answered")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: "Previous" }));
        expect(screen.getByRole("heading", { name: "Implement an LRU cache." })).toBeTruthy();
    });

    it("keeps round submission available from the focused workspace", () => {
        const onSubmit = vi.fn();
        render(
            <OAForm
                questions={[{ question: { text: "Describe a race condition." } }]}
                answers={["answer"]}
                spokenAnswers={[""]}
                codingEnabled={[false]}
                onCodingModeChange={vi.fn()}
                codeDraftPrefix="round-2"
                onSpokenChange={vi.fn()}
                onChange={vi.fn()}
                onSubmit={onSubmit}
                onSkip={vi.fn()}
                submitting={false}
                supportsTTS={false}
                supportsSTT={false}
                listening={false}
                listeningTarget={null}
                onSpeak={vi.fn()}
                onStartListening={vi.fn()}
                onStopListening={vi.fn()}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: "Submit round" }));
        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(screen.getByText("Ready to submit")).toBeTruthy();
    });
});
