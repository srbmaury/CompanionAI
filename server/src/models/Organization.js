import mongoose from "mongoose";

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
        billing: {
            plan: { type: String, enum: ["trial", "starter", "growth", "enterprise"], default: "trial" },
            subscriptionStatus: { type: String, enum: ["inactive", "incomplete", "incomplete_expired", "trialing", "active", "past_due", "canceled", "unpaid", "paused"], default: "inactive" },
            provider: { type: String, enum: ["none", "stripe"], default: "none" },
            stripeCustomerId: { type: String, default: "" },
            stripeSubscriptionId: { type: String, default: "" },
            currentPeriodEnd: { type: Date, default: null },
            trialCreditsUsed: { type: Number, min: 0, default: 0 },
        },
    },
    { timestamps: true }
);

organizationSchema.index({ createdBy: 1, createdAt: -1 });
organizationSchema.index({ "billing.stripeCustomerId": 1 }, { sparse: true });
organizationSchema.index({ "billing.stripeSubscriptionId": 1 }, { sparse: true });

export default mongoose.model("Organization", organizationSchema);
