import Assessment from "../models/Assessment.js";

export const getCandidateInvitationPrefill = async (req, res, next) => {
    try {
        const assessment = await Assessment.findOne({
            shareToken: req.params.shareToken,
            status: "active",
            $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
        });
        if (!assessment) return res.status(404).json({ message: "Assessment unavailable" });
        const invitation = assessment.invitations?.id(req.params.invitationId);
        if (!invitation || invitation.status === "revoked") return res.status(404).json({ message: "Invitation unavailable" });
        return res.json({
            name: invitation.name || "",
            email: invitation.email || "",
            emailLocked: true,
        });
    } catch (error) {
        return next(error instanceof Error ? error : new Error(String(error)));
    }
};

export default getCandidateInvitationPrefill;
