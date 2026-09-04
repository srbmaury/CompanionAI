import mongoose from "mongoose";

const adaptiveInterviewTraceSchema = new mongoose.Schema({
    round: { type: mongoose.Schema.Types.ObjectId, ref: "Round", required: true, index: true },
    eventType: {
        type: String,
        enum: ["initialized", "question_selected", "evidence_evaluated", "follow_up", "completed", "policy_updated"],
        required: true,
        index: true,
    },
    action: { type: String, maxlength: 40, default: "" },
    targetCompetency: { type: String, maxlength: 80, default: "" },
    sourceType: { type: String, maxlength: 40, default: "" },
    usedResumeClaim: { type: Boolean, default: false },
    fallbackUsed: { type: Boolean, default: false },
    questionCount: { type: Number, min: 0, default: 0 },
    questionsAsked: { type: Number, min: 0, default: 0 },
    followUpCount: { type: Number, min: 0, default: 0 },
    difficultyFrom: { type: Number, min: 1, max: 5 },
    difficultyTo: { type: Number, min: 1, max: 5 },
    coverageBefore: { type: Number, min: 0, max: 1, default: 0 },
    coverageAfter: { type: Number, min: 0, max: 1, default: 0 },
    averageConfidenceBefore: { type: Number, min: 0, max: 1, default: 0 },
    averageConfidenceAfter: { type: Number, min: 0, max: 1, default: 0 },
    engineVersion: { type: String, maxlength: 80, default: "adaptive-v1" },
    promptVersion: { type: String, maxlength: 80, default: "adaptive-2026-09-v1" },
    reason: { type: String, maxlength: 500, default: "" },
}, { timestamps: true });

adaptiveInterviewTraceSchema.index({ createdAt: -1 });
adaptiveInterviewTraceSchema.index({ round: 1, createdAt: 1 });

export default mongoose.model("AdaptiveInterviewTrace", adaptiveInterviewTraceSchema);
