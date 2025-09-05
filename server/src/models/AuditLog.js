import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        action: { type: String, required: true },
        entityType: { type: String },
        entityId: { type: String },
        ip: { type: String },
        userAgent: { type: String },
        requestId: { type: String },
        metadata: { type: Object },
    },
    { timestamps: true }
);

AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: Number(process.env.AUDIT_TTL_SECONDS || 60 * 60 * 24 * 90) });

const AuditLog = mongoose.model("AuditLog", AuditLogSchema);

export default AuditLog;