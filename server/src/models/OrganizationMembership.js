import mongoose from "mongoose";

export const ORGANIZATION_ROLES = ["owner", "admin", "recruiter", "hiring_manager", "reviewer"];

const organizationMembershipSchema = new mongoose.Schema(
    {
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
            index: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        role: {
            type: String,
            enum: ORGANIZATION_ROLES,
            required: true,
            default: "reviewer",
        },
        status: {
            type: String,
            enum: ["active", "disabled"],
            default: "active",
            index: true,
        },
        joinedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

organizationMembershipSchema.index({ organization: 1, user: 1 }, { unique: true });
organizationMembershipSchema.index({ user: 1, status: 1, createdAt: 1 });

export default mongoose.model("OrganizationMembership", organizationMembershipSchema);
