import mongoose from "mongoose";

const billingEventSchema = new mongoose.Schema({
    provider: { type: String, enum: ["stripe"], required: true },
    eventId: { type: String, required: true },
    type: { type: String, required: true },
    processedAt: { type: Date, default: Date.now },
}, { timestamps: true });
billingEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

export default mongoose.model("BillingEvent", billingEventSchema);
