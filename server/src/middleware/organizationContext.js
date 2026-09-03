import mongoose from "mongoose";
import Organization from "../models/Organization.js";
import OrganizationMembership from "../models/OrganizationMembership.js";

const defaultOrganizationName = (user) => {
    const firstName = (user?.name || "").trim().split(/\s+/)[0];
    return firstName ? `${firstName}'s Hiring Team` : "My Hiring Team";
};

export const ensureDefaultOrganization = async (user) => {
    let membership = await OrganizationMembership.findOne({
        user: user._id,
        status: "active",
    })
        .sort({ createdAt: 1 })
        .populate("organization");

    if (membership?.organization) return membership;

    const organization = await Organization.create({
        name: defaultOrganizationName(user),
        createdBy: user._id,
    });

    try {
        membership = await OrganizationMembership.create({
            organization: organization._id,
            user: user._id,
            role: "owner",
            status: "active",
        });
        await membership.populate("organization");
        return membership;
    } catch (error) {
        // A concurrent request may have created the user's first organization.
        if (error?.code === 11000) {
            await Organization.deleteOne({ _id: organization._id });
            return OrganizationMembership.findOne({ user: user._id, status: "active" })
                .sort({ createdAt: 1 })
                .populate("organization");
        }
        throw error;
    }
};

export const organizationContext = async (req, res, next) => {
    try {
        const requestedOrganizationId = (req.get("x-organization-id") || "").trim();
        let membership;

        if (requestedOrganizationId) {
            if (!mongoose.isValidObjectId(requestedOrganizationId)) {
                return res.status(400).json({ message: "Invalid organization" });
            }
            membership = await OrganizationMembership.findOne({
                organization: requestedOrganizationId,
                user: req.user._id,
                status: "active",
            }).populate("organization");
            if (!membership?.organization) {
                return res.status(403).json({ message: "You do not have access to this organization" });
            }
        } else {
            membership = await ensureDefaultOrganization(req.user);
        }

        if (!membership?.organization) {
            return res.status(403).json({ message: "No active hiring organization" });
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
