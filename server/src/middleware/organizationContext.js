import mongoose from "mongoose";
import OrganizationMembership from "../models/OrganizationMembership.js";

export const organizationContext = async (req, res, next) => {
    try {
        const requestedOrganizationId = (req.get("x-organization-id") || "").trim();
        if (!requestedOrganizationId) {
            return res.status(400).json({ message: "Choose a hiring organization" });
        }
        if (!mongoose.isValidObjectId(requestedOrganizationId)) {
            return res.status(400).json({ message: "Invalid organization" });
        }

        const membership = await OrganizationMembership.findOne({
            organization: requestedOrganizationId,
            user: req.user._id,
            status: "active",
        }).populate("organization");

        if (!membership?.organization) {
            return res.status(403).json({ message: "You do not have access to this organization" });
        }

        req.organization = membership.organization;
        req.organizationId = membership.organization._id;
        req.organizationMembership = membership;
        req.organizationRole = membership.role;
        return next();
    } catch (error) {
        return next(error);
    }
};

export const requireOrganizationRole = (...allowedRoles) => (req, res, next) => {
    if (!req.organizationMembership || !allowedRoles.includes(req.organizationRole)) {
        return res.status(403).json({ message: "You do not have permission to perform this action" });
    }
    return next();
};
