import mongoose from "mongoose";

const reminderDeliverySchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reminderKey: { type: String, required: true },
    scheduledFor: { type: Date, required: true, index: true },
    status: { type: String, enum: ["pending", "processing", "sent", "failed"], default: "pending", index: true },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    lockedAt: Date,
    sentAt: Date,
    providerMessageId: String,
    lastError: { type: String, maxlength: 500 },
}, { timestamps: true });

reminderDeliverySchema.index({ user: 1, reminderKey: 1 }, { unique: true });

export default mongoose.model("ReminderDelivery", reminderDeliverySchema);
