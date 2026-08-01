import mongoose from "mongoose";

const resumeReviewSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    resume: { type: mongoose.Schema.Types.ObjectId, ref: "Resume", required: true },
    resumeName: { type: String, required: true, maxlength: 200 },
    role: { type: String, default: "", maxlength: 200 },
    jobDescription: { type: String, default: "", maxlength: 12000 },
    summary: { type: String, required: true, maxlength: 2000 },
    atsScore: { type: Number, min: 0, max: 100, required: true },
    strengths: { type: [String], default: [] },
    gaps: { type: [String], default: [] },
    keywordsMatched: { type: [String], default: [] },
    improvementSuggestions: { type: [String], default: [] },
    roleAlignment: { type: String, default: "", maxlength: 2000 },
}, { timestamps: true });

resumeReviewSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("ResumeReview", resumeReviewSchema);
