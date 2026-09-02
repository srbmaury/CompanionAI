import mongoose from "mongoose";

const assessmentQuestionSchema = new mongoose.Schema({
    text: { type: String, required: true, maxlength: 1000 },
    weight: { type: Number, min: 0.1, max: 10, default: 1 },
    competencies: [{ type: String, maxlength: 80 }],
    knockout: { type: Boolean, default: false },
}, { _id: true });

const assessmentRoundSchema = new mongoose.Schema({
    name: { type: String, required: true, maxlength: 80 },
    description: { type: String, maxlength: 300 },
    deliveryMode: { type: String, enum: ["conversational", "online-assessment", "system-design"], default: "conversational" },
    questions: { type: [assessmentQuestionSchema], validate: (value) => value.length >= 1 && value.length <= 20 },
}, { _id: true });

const assessmentSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, maxlength: 160 },
    company: { type: String, maxlength: 120, default: "" },
    jobRole: { type: String, required: true, maxlength: 120 },
    jobDescription: { type: String, required: true, maxlength: 4000 },
    shareToken: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ["draft", "scheduled", "active", "closed", "archived"], default: "draft", index: true },
    publishedAt: Date,
    archivedAt: Date,
    opensAt: Date,
    timezone: { type: String, maxlength: 100, default: "UTC" },
    followUpsEnabled: { type: Boolean, default: true },
    inviteOnly: { type: Boolean, default: false },
    candidateInstructions: { type: String, maxlength: 1200, default: "" },
    contactEmail: { type: String, maxlength: 254, default: "" },
    durationMinutes: { type: Number, min: 5, max: 240, default: 30 },
    expiresAt: Date,
    integrity: {
        enabled: { type: Boolean, default: false },
        requireFullscreen: { type: Boolean, default: false },
        trackFocus: { type: Boolean, default: true },
        trackClipboard: { type: Boolean, default: true },
        requireCamera: { type: Boolean, default: false },
        monitorFacePresence: { type: Boolean, default: false },
        retentionDays: { type: Number, min: 1, max: 365, default: 30 },
    },
    rubric: [{ name: { type: String, maxlength: 80 }, description: { type: String, maxlength: 300 }, weight: { type: Number, min: 1, max: 100, default: 1 } }],
    templateName: { type: String, maxlength: 160, default: "" },
    templateVersion: { type: Number, min: 1, default: 1 },
    invitations: [{
        email: { type: String, lowercase: true, trim: true, maxlength: 254 },
        name: { type: String, maxlength: 120, default: "" },
        status: { type: String, enum: ["queued", "invited", "sent", "delivered", "failed", "bounced", "opened", "started", "completed", "revoked"], default: "queued" },
        invitedAt: { type: Date, default: Date.now }, lastSentAt: Date, nextAttemptAt: Date, openedAt: Date, revokedAt: Date,
        attempts: { type: Number, default: 0 }, providerMessageId: String, lastError: { type: String, maxlength: 500, default: "" },
    }],
    rounds: { type: [assessmentRoundSchema], validate: (value) => value.length >= 1 && value.length <= 5 },
}, { timestamps: true });

assessmentSchema.index({ owner: 1, createdAt: -1 });

export default mongoose.model("Assessment", assessmentSchema);
