import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SystemDesignCanvas from "../components/SystemDesignCanvas";

vi.mock("@excalidraw/excalidraw", () => ({
    Excalidraw: () => <div data-testid="architecture-canvas">Canvas</div>,
}));

afterEach(() => cleanup());

describe("SystemDesignCanvas interview experience", () => {
    it("offers a distraction-free focus mode without leaving the interview", () => {
        render(<SystemDesignCanvas value="" onChange={vi.fn()} />);

        expect(screen.getByText("Design workspace")).toBeTruthy();
        expect(screen.getByTestId("architecture-canvas")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: "Focus canvas" }));
        expect(screen.getByRole("button", { name: "Exit focus mode" })).toBeTruthy();
        expect(screen.getByText(/Focus mode only enlarges the workspace/)).toBeTruthy();

        fireEvent.keyDown(window, { key: "Escape" });
        expect(screen.getByRole("button", { name: "Focus canvas" })).toBeTruthy();
    });
});
