import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NotificationProvider, useNotify } from "../context/NotificationContext";

function NotificationTrigger() {
    const notify = useNotify();
    return <button onClick={() => notify("Changes saved.", "success")}>Save</button>;
}

describe("NotificationProvider", () => {
    it("shows action feedback as a visible popup", async () => {
        render(<NotificationProvider><NotificationTrigger /></NotificationProvider>);

        fireEvent.click(screen.getByRole("button", { name: "Save" }));

        expect((await screen.findByRole("status")).textContent).toContain("Changes saved.");
    });
});
