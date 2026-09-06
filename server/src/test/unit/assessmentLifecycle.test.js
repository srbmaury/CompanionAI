import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const updateMany = vi.fn(); const find = vi.fn(); const sendMail = vi.fn();
vi.mock("../../models/Assessment.js", () => ({ default: { updateMany, find } }));
vi.mock("../../utils/mailer.js", () => ({ sendMail }));
const { processAssessmentLifecycle } = await import("../../services/assessmentLifecycle.js");

const originalClientOrigin = process.env.CLIENT_ORIGIN;

describe("assessment lifecycle processing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        updateMany.mockResolvedValue({ modifiedCount: 1 });
        find.mockResolvedValue([]);
        process.env.CLIENT_ORIGIN = "https://app.evalcue.example/";
    });

    afterAll(() => {
        if (originalClientOrigin === undefined) delete process.env.CLIENT_ORIGIN;
        else process.env.CLIENT_ORIGIN = originalClientOrigin;
    });

    it("opens scheduled assessments and closes expired ones", async () => {
        const result = await processAssessmentLifecycle(new Date("2026-08-12T12:00:00Z"));
        expect(updateMany).toHaveBeenCalledTimes(2);
        expect(result).toMatchObject({ opened: 1, closed: 1 });
    });

    it("delivers queued invitations using the documented client origin", async () => {
        const invitation = { _id: "invite-1", email: "candidate@example.com", name: "Candidate", status: "queued", attempts: 0 };
        const assessment = { title: "Backend", jobRole: "Engineer", shareToken: "token", timezone: "UTC", invitations: [invitation], save: vi.fn() };
        find.mockResolvedValue([assessment]); sendMail.mockResolvedValue({ messageId: "provider-1" });
        const result = await processAssessmentLifecycle(new Date("2026-08-12T12:00:00Z"));
        expect(result.sent).toBe(1);
        expect(invitation).toMatchObject({ status: "sent", attempts: 1, providerMessageId: "provider-1" });
        expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.stringContaining("https://app.evalcue.example/assessment/token?invite=invite-1"),
            html: expect.stringContaining("https://app.evalcue.example/assessment/token?invite=invite-1"),
        }));
        expect(sendMail.mock.calls[0][0].text).not.toContain("localhost");
        expect(assessment.save).toHaveBeenCalledOnce();
    });
});
