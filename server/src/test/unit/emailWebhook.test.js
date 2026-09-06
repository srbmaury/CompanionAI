import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateOne = vi.fn();
vi.mock("../../models/Assessment.js", () => ({ default: { updateOne } }));
const { default: routes } = await import("../../routes/emailWebhookRoutes.js");

describe("Brevo delivery webhook", () => {
    let app;
    beforeEach(() => { process.env.BREVO_WEBHOOK_SECRET = "long-test-secret"; app = express(); app.use(express.json()); app.use(routes); updateOne.mockResolvedValue({ modifiedCount: 1 }); });
    afterEach(() => vi.clearAllMocks());

    it("rejects events without the configured secret", async () => {
        await request(app).post("/brevo").send({ event: "delivered", email: "candidate@example.com" }).expect(401);
        expect(updateOne).not.toHaveBeenCalled();
    });

    it("marks matching provider messages delivered", async () => {
        const response = await request(app).post("/brevo").set("x-evalcue-webhook-secret", "long-test-secret").send({ event: "delivered", "message-id": "provider-1", email: "candidate@example.com" }).expect(200);
        expect(response.body.updated).toBe(true);
        expect(updateOne).toHaveBeenCalledWith({ "invitations.providerMessageId": "provider-1" }, expect.objectContaining({ $set: expect.objectContaining({ "invitations.$[invitation].status": "delivered" }) }), expect.any(Object));
    });
});
