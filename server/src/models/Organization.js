import mongoose from "mongoose";

const subscriptionStatuses = [
    "inactive",
    "incomplete",
    "incomplete_expired",
    "trialing",
    "active",
    "past_due",
    "canceled",
    "unpaid",
    "paused",
];

const organizationSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 120,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        hiringPlan: {
            type: String,
            enum: ["trial", "starter", "growth", "enterprise"],
            default: "trial",
            index: true,
        },
        hiringSubscriptionStatus: {
            type: String,
            enum: subscriptionStatuses,
            default: "inactive",
        },
        hiringTrialEligible: {
            type: Boolean,
            default: true,
        },
        hiringBillingProvider: {
            type: String,
            enum: ["none", "stripe"],
            default: "none",
            select: false,
        },
        hiringBillingCustomerId: {
            type: String,
            default: "",
            select: false,
        },
        hiringBillingSubscriptionId: {
            type: String,
            default: "",
            select: false,
        },
        hiringCurrentPeriodEnd: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

organizationSchema.index({ createdBy: 1, createdAt: -1 });
organizationSchema.index({ hiringBillingCustomerId: 1 }, { sparse: true });

export default mongoose.model("Organization", organizationSchema);
