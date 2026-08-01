import mongoose from "mongoose";

const productEventSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    event: { type: String, required: true, index: true },
    path: { type: String, maxlength: 200 },
    plan: { type: String, enum: ["free", "pro"] },
    occurredAt: { type: Date, default: Date.now },
}, { timestamps: true });

productEventSchema.index({ occurredAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

export default mongoose.model("ProductEvent", productEventSchema);
