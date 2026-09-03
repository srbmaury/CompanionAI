import { beforeEach, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NotificationProvider, useNotifications, useNotify } from "../context/NotificationContext";

function NotificationHarness() {
    const notify = useNotify();
    const { notifications, unreadCount, markNotificationRead, markAllRead, dismissNotification } = useNotifications();
    return <>
        <button onClick={() => notify("Changes saved.", "success")}>Save</button>
        <button onClick={() => notify("Changes saved.", "success")}>Save duplicate</button>
        <button onClick={() => markAllRead()}>Mark all</button>
        <button onClick={() => notifications[0] && markNotificationRead(notifications[0].id)}>Mark first</button>
        <button onClick={() => notifications[0] && dismissNotification(notifications[0].id)}>Dismiss first</button>
        <span data-testid="unread">{unreadCount}</span>
        <span data-testid="count">{notifications.length}</span>
    </>;
}

beforeEach(() => window.sessionStorage.clear());

describe("NotificationProvider", () => {
    it("shows action feedback and tracks unread state", async () => {
        render(<NotificationProvider><NotificationHarness /></NotificationProvider>);
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        expect((await screen.findByRole("status")).textContent).toContain("Changes saved.");
        expect(screen.getByTestId("unread").textContent).toBe("1");
        fireEvent.click(screen.getByRole("button", { name: "Mark first" }));
        expect(screen.getByTestId("unread").textContent).toBe("0");
    });

    it("deduplicates rapid repeats and supports dismissing history", () => {
        render(<NotificationProvider><NotificationHarness /></NotificationProvider>);
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        fireEvent.click(screen.getByRole("button", { name: "Save duplicate" }));
        expect(screen.getByTestId("count").textContent).toBe("1");
        fireEvent.click(screen.getByRole("button", { name: "Dismiss first" }));
        expect(screen.getByTestId("count").textContent).toBe("0");
    });
});
