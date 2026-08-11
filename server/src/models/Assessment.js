import mongoose from "mongoose";

const assessmentQuestionSchema = new mongoose.Schema({
    text: { type: String, required: true, maxlength: 1000 },
}, { _id: true });

const assessmentRoundSchema = new mongoose.Schema({
    name: { type: String, required: true, maxlength: 80 },
    description: { type: String, maxlength: 300 },
    questions: { type: [assessmentQuestionSchema], validate: (value) => value.length >= 1 && value.length <= 20 },
}, { _id: true });

const assessmentSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, maxlength: 160 },
    company: { type: String, maxlength: 120, default: "" },
    jobRole: { type: String, required: true, maxlength: 120 },
    jobDescription: { type: String, required: true, maxlength: 4000 },
    shareToken: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ["active", "closed"], default: "active", index: true },
    followUpsEnabled: { type: Boolean, default: true },
    candidateInstructions: { type: String, maxlength: 1200, default: "" },
    contactEmail: { type: String, maxlength: 254, default: "" },
    durationMinutes: { type: Number, min: 5, max: 240, default: 30 },
    expiresAt: Date,
    rounds: { type: [assessmentRoundSchema], validate: (value) => value.length >= 1 && value.length <= 5 },
}, { timestamps: true });

assessmentSchema.index({ owner: 1, createdAt: -1 });

export default mongoose.model("Assessment", assessmentSchema);
