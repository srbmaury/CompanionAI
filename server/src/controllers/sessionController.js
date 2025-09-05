import { listUserSessions, revokeSessionById, revokeAllSessionsForUser, revokeRefreshFromRequest, clearAuthCookies } from "../utils/tokens.js";

export const listSessions = async (req, res) => {
    const sessions = await listUserSessions(req.user._id);
    res.json({ sessions });
};

export const revokeSession = async (req, res) => {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: "Missing session id" });
    const ok = await revokeSessionById(req.user._id, id);
    if (!ok) return res.status(404).json({ message: "Session not found" });
    res.json({ message: "Session revoked" });
};

export const revokeAllSessions = async (req, res) => {
    await revokeAllSessionsForUser(req.user._id);
    // Also clear current cookies if caller intends to sign out everywhere
    try { await revokeRefreshFromRequest(req); } catch {}
    try { clearAuthCookies(res); } catch {}
    res.json({ message: "All sessions revoked" });
};

export default { listSessions, revokeSession, revokeAllSessions };
