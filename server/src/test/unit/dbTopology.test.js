import { describe, expect, it } from "vitest";
import { mongoTopologyKind } from "../../config/db.js";

describe("MongoDB topology detection", () => {
    it("recognizes mongos as a sharded transaction-capable topology", () => {
        expect(mongoTopologyKind({ msg: "isdbgrid" })).toBe("sharded");
    });

    it("recognizes replica sets without relying on logicalSessionTimeoutMinutes", () => {
        expect(mongoTopologyKind({ setName: "rs0" })).toBe("replica-set");
        expect(mongoTopologyKind({ logicalSessionTimeoutMinutes: 30 })).toBe("standalone");
    });
});
