import Organization from "../models/Organization.js";
import OrganizationMembership from "../models/OrganizationMembership.js";
import User from "../models/User.js";
import { ensureDefaultOrganization } from "../middleware/organizationContext.js";

const activeMembership = (organizationId, userId) => OrganizationMembership.findOne({
    organization: organizationId,
    user: userId,
    status: "active",
});

const organizationView = (membership, memberCount = 0) => ({
    _id: membership.organization._id,
    name: membership.organization.name,
    role: membership.role,
    memberCount,
    createdAt: membership.organization.createdAt,
});

const canManageMember = (actorRole, targetRole, nextRole = targetRole) => {
    if (targetRole === "owner" || nextRole === "owner") return false;
    if (actorRole === "owner") return true;
    if (actorRole !== "admin") return false;
    return targetRole !== "admin" && nextRole !== "admin";
};

export const listOrganizations = async (req, res, next) => {
    try {
        await ensureDefaultOrganization(req.user);
        const memberships = await OrganizationMembership.find({ user: req.user._id, status: "active" })
            .sort({ createdAt: 1 })
            .populate("organization");
        const organizationIds = memberships.map((membership) => membership.organization?._id).filter(Boolean);
        const counts = organizationIds.length
            ? await OrganizationMembership.aggregate([
                { $match: { organization: { $in: organizationIds }, status: "active" } },
                { $group: { _id: "$organization", count: { $sum: 1 } } },
            ])
            : [];
        const countByOrganization = new Map(counts.map((item) => [String(item._id), item.count]));
        return res.json({
            organizations: memberships
                .filter((membership) => membership.organization)
                .map((membership) => organizationView(
                    membership,
                    countByOrganization.get(String(membership.organization._id)) || 0,
                )),
        });
    } catch (error) {
        return next(error);
    }
};

export const createOrganization = async (req, res, next) => {
    try {
        const organization = await Organization.create({
            name: req.body.name,
            createdBy: req.user._id,
        });
        const membership = await OrganizationMembership.create({
            organization: organization._id,
            user: req.user._id,
            role: "owner",
            status: "active",
        });
        membership.organization = organization;
        return res.status(201).json({ organization: organizationView(membership, 1) });
    } catch (error) {
        return next(error);
    }
};

export const updateOrganization = async (req, res, next) => {
    try {
        const membership = await activeMembership(req.params.organizationId, req.user._id);
        if (!membership) return res.status(404).json({ message: "Organization not found" });
        if (!["owner", "admin"].includes(membership.role)) {
            return res.status(403).json({ message: "You do not have permission to update this organization" });
        }
        const organization = await Organization.findByIdAndUpdate(
            req.params.organizationId,
            { $set: { name: req.body.name } },
            { new: true },
        );
        if (!organization) return res.status(404).json({ message: "Organization not found" });
        const memberCount = await OrganizationMembership.countDocuments({ organization: organization._id, status: "active" });
        membership.organization = organization;
        return res.json({ organization: organizationView(membership, memberCount) });
    } catch (error) {
        return next(error);
    }
};

export const listMembers = async (req, res, next) => {
    try {
        const requester = await activeMembership(req.params.organizationId, req.user._id);
        if (!requester) return res.status(404).json({ message: "Organization not found" });
        const memberships = await OrganizationMembership.find({
            organization: req.params.organizationId,
            status: "active",
        })
            .sort({ createdAt: 1 })
            .populate("user", "_id name email");
        return res.json({
            members: memberships.map((membership) => ({
                _id: membership._id,
                user: membership.user,
                role: membership.role,
                joinedAt: membership.joinedAt,
            })),
            currentRole: requester.role,
        });
    } catch (error) {
        return next(error);
    }
};

export const addMember = async (req, res, next) => {
    try {
        const actor = await activeMembership(req.params.organizationId, req.user._id);
        if (!actor || !["owner", "admin"].includes(actor.role)) {
            return res.status(403).json({ message: "You do not have permission to manage this team" });
        }
        if (!canManageMember(actor.role, "reviewer", req.body.role)) {
            return res.status(403).json({ message: "You cannot assign that role" });
        }
        const user = await User.findOne({ email: req.body.email.toLowerCase().trim() }).select("_id name email");
        if (!user) return res.status(404).json({ message: "No CompanionAI account exists for that email" });

        let membership = await OrganizationMembership.findOne({
            organization: req.params.organizationId,
            user: user._id,
        });
        if (membership?.status === "active") {
            return res.status(409).json({ message: "This person is already a member" });
        }
        if (membership) {
            membership.role = req.body.role;
            membership.status = "active";
            membership.joinedAt = new Date();
            await membership.save();
        } else {
            membership = await OrganizationMembership.create({
                organization: req.params.organizationId,
                user: user._id,
                role: req.body.role,
                status: "active",
            });
        }
        return res.status(201).json({
            member: { _id: membership._id, user, role: membership.role, joinedAt: membership.joinedAt },
        });
    } catch (error) {
        return next(error);
    }
};

export const updateMemberRole = async (req, res, next) => {
    try {
        const actor = await activeMembership(req.params.organizationId, req.user._id);
        if (!actor || !["owner", "admin"].includes(actor.role)) {
            return res.status(403).json({ message: "You do not have permission to manage this team" });
        }
        const target = await OrganizationMembership.findOne({
            _id: req.params.membershipId,
            organization: req.params.organizationId,
            status: "active",
        }).populate("user", "_id name email");
        if (!target) return res.status(404).json({ message: "Member not found" });
        if (!canManageMember(actor.role, target.role, req.body.role)) {
            return res.status(403).json({ message: "You cannot change this member's role" });
        }
        target.role = req.body.role;
        await target.save();
        return res.json({ member: { _id: target._id, user: target.user, role: target.role, joinedAt: target.joinedAt } });
    } catch (error) {
        return next(error);
    }
};

export const removeMember = async (req, res, next) => {
    try {
        const actor = await activeMembership(req.params.organizationId, req.user._id);
        if (!actor || !["owner", "admin"].includes(actor.role)) {
            return res.status(403).json({ message: "You do not have permission to manage this team" });
        }
        const target = await OrganizationMembership.findOne({
            _id: req.params.membershipId,
            organization: req.params.organizationId,
            status: "active",
        });
        if (!target) return res.status(404).json({ message: "Member not found" });
        if (!canManageMember(actor.role, target.role)) {
            return res.status(403).json({ message: "You cannot remove this member" });
        }
        target.status = "disabled";
        await target.save();
        return res.status(204).end();
    } catch (error) {
        return next(error);
    }
};
