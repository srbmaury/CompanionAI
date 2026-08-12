export const createFacePresenceState = () => ({ absenceStartedAt: null, absenceRecorded: false, multipleFrames: 0, multipleRecorded: false });

export function evaluateFacePresence(previous, faceCount, now) {
    const state = { ...previous };
    if (faceCount === 0) {
        state.multipleFrames = 0; state.multipleRecorded = false;
        state.absenceStartedAt ??= now;
        const durationSeconds = Math.round((now - state.absenceStartedAt) / 1000);
        if (durationSeconds >= 10 && !state.absenceRecorded) {
            state.absenceRecorded = true;
            return { state, status: "missing", event: { type: "face_missing", metadata: { durationSeconds } } };
        }
        return { state, status: durationSeconds >= 5 ? "missing" : "checking" };
    }

    const restoredEvent = state.absenceRecorded ? { type: "face_restored", metadata: { durationSeconds: Math.max(1, Math.round((now - state.absenceStartedAt) / 1000)) } } : null;
    state.absenceStartedAt = null; state.absenceRecorded = false;
    if (faceCount > 1) {
        state.multipleFrames += 1;
        if (state.multipleFrames >= 3 && !state.multipleRecorded) {
            if (restoredEvent) return { state, status: "multiple", event: restoredEvent };
            state.multipleRecorded = true;
            return { state, status: "multiple", event: { type: "multiple_faces", metadata: { faceCount } } };
        }
        return { state, status: "multiple", event: restoredEvent };
    }

    state.multipleFrames = 0; state.multipleRecorded = false;
    return { state, status: "present", event: restoredEvent };
}
