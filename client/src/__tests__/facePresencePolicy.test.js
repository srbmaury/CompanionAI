import { describe, expect, it } from "vitest";
import { createFacePresenceState, evaluateFacePresence } from "../utils/facePresencePolicy";

describe("face presence policy", () => {
    it("ignores brief misses, warns after five seconds, and records after ten", () => {
        let result = evaluateFacePresence(createFacePresenceState(), 0, 1000);
        expect(result.status).toBe("checking");
        result = evaluateFacePresence(result.state, 0, 6000);
        expect(result.status).toBe("missing");
        expect(result.event).toBeUndefined();
        result = evaluateFacePresence(result.state, 0, 11000);
        expect(result.event).toEqual({ type: "face_missing", metadata: { durationSeconds: 10 } });
        result = evaluateFacePresence(result.state, 1, 14000);
        expect(result.event).toEqual({ type: "face_restored", metadata: { durationSeconds: 13 } });
    });

    it("records multiple faces only after three consecutive detections", () => {
        let state = createFacePresenceState();
        let result;
        for (let index = 0; index < 3; index += 1) { result = evaluateFacePresence(state, 2, index * 1000); state = result.state; }
        expect(result.event).toEqual({ type: "multiple_faces", metadata: { faceCount: 2 } });
        expect(evaluateFacePresence(state, 2, 4000).event).toBeNull();
    });
});
