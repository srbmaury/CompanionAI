import crypto from "crypto";
import express from "express";
import Assessment from "../models/Assessment.js";

const router = express.Router();
const safeEqual = (left, right) => {
    const a = Buffer.from(String(left || "")); const b = Buffer.from(String(right || ""));
    return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
};

router.post("/brevo", async (req, res, next) => {
    try {
        const configured = process.env.BREVO_WEBHOOK_SECRET;
        const supplied = req.get("x-companionai-webhook-secret") || req.query.secret;
        if (!configured || !safeEqual(supplied, configured)) return res.status(401).json({ message: "Invalid webhook secret" });
        const event = String(req.body?.event || "").toLowerCase();
        const messageId = String(req.body?.["message-id"] || req.body?.messageId || "");
        const email = String(req.body?.email || "").toLowerCase();
        const status = ["delivered"].includes(event) ? "delivered" : ["hard_bounce", "soft_bounce", "blocked", "invalid_email"].includes(event) ? "bounced" : ["spam", "complaint"].includes(event) ? "bounced" : null;
        if (!status || (!messageId && !email)) return res.json({ received: true, updated: false });
        const match = messageId ? { "invitations.providerMessageId": messageId } : { "invitations.email": email, "invitations.status": { $in: ["sent", "failed"] } };
        const result = await Assessment.updateOne(match, { $set: { "invitations.$[invitation].status": status, "invitations.$[invitation].lastError": status === "bounced" ? event : "" } }, { arrayFilters: [{ ...(messageId ? { "invitation.providerMessageId": messageId } : { "invitation.email": email }), "invitation.status": { $nin: ["opened", "started", "completed", "revoked"] } }] });
        return res.json({ received: true, updated: Boolean(result.modifiedCount) });
    } catch (error) { return next(error); }
});

export default router;
