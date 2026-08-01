import mongoose from "mongoose";

const usageCounterSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    metric: { type: String, required: true },
    period: { type: String, required: true },
    used: { type: Number, min: 0, default: 0 },
}, { timestamps: true });
usageCounterSchema.index({ user: 1, metric: 1, period: 1 }, { unique: true });

export default mongoose.model("UsageCounter", usageCounterSchema);
