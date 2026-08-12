import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn(() => Promise.resolve());
vi.mock("../../models/AuditLog.js", () => ({ default: { create } }));

const { default: audit } = await import("../../middleware/audit.js");

const makeResponse = () => {
    const response = new EventEmitter();
    response.statusCode = 200;
    response.json = vi.fn((body) => body);
    return response;
};

describe("audit middleware", () => {
    beforeEach(() => create.mockClear());

    it("records the completed response without copying sensitive body fields", async () => {
        const req = { user: { _id: "user-1" }, body: { newPassword: "NeverStoreThis", status: "closed" }, method: "PATCH", originalUrl: "/api/assessments/a1?source=test", ip: "127.0.0.1", id: "request-1", get: () => "test-agent" };
        const res = makeResponse();
        const middleware = audit("assessment.status_update", { entityType: "Assessment", getEntityId: () => "a1", pickBody: (body) => ({ status: body.status }) });

        middleware(req, res, () => { res.statusCode = 204; res.emit("finish"); });
        await vi.waitFor(() => expect(create).toHaveBeenCalledOnce());

        expect(create).toHaveBeenCalledWith(expect.objectContaining({ action: "assessment.status_update", entityId: "a1", outcome: "success", statusCode: 204, method: "PATCH", path: "/api/assessments/a1", metadata: { status: "closed" } }));
        expect(JSON.stringify(create.mock.calls[0][0])).not.toContain("NeverStoreThis");
    });

    it("records failed responses as failures", async () => {
        const req = { body: {}, method: "POST", originalUrl: "/api/example", ip: "127.0.0.1", get: () => undefined };
        const res = makeResponse();

        audit("example.action")(req, res, () => { res.statusCode = 500; res.emit("finish"); });
        await vi.waitFor(() => expect(create).toHaveBeenCalledOnce());

        expect(create).toHaveBeenCalledWith(expect.objectContaining({ outcome: "failure", statusCode: 500 }));
    });
});
