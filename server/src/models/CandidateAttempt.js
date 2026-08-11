import mongoose from "mongoose";

const attemptQuestionSchema = new mongoose.Schema({
    text: { type: String, required: true, maxlength: 1000 },
    answer: { type: String, maxlength: 5000, default: "" },
    followUpQuestion: { type: String, maxlength: 1000, default: "" },
    followUpAnswer: { type: String, maxlength: 5000, default: "" },
    feedbackComment: { type: String, maxlength: 2500, default: "" },
    suggestions: [{ type: String, maxlength: 300 }],
    score: { type: Number, min: 0, max: 10 },
}, { _id: true });

const attemptRoundSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    questions: [attemptQuestionSchema],
    score: { type: Number, min: 0, max: 10 },
}, { _id: true });

const candidateAttemptSchema = new mongoose.Schema({
    assessment: { type: mongoose.Schema.Types.ObjectId, ref: "Assessment", required: true, index: true },
    candidateName: { type: String, required: true, maxlength: 120 },
    candidateEmail: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    accessTokenHash: { type: String, required: true, select: false },
    status: { type: String, enum: ["started", "submitted"], default: "started", index: true },
    startedAt: { type: Date, default: Date.now },
    privacyConsentAt: { type: Date, required: true, default: Date.now },
    submittedAt: Date,
    rounds: [attemptRoundSchema],
    overallScore: { type: Number, min: 0, max: 10 },
}, { timestamps: true });

candidateAttemptSchema.index({ assessment: 1, candidateEmail: 1 }, { unique: true });
candidateAttemptSchema.index({ assessment: 1, createdAt: -1 });

export default mongoose.model("CandidateAttempt", candidateAttemptSchema);
