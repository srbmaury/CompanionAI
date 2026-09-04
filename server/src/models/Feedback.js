import mongoose from "mongoose";

const dimensionSchema = new mongoose.Schema({
    name: { type: String, maxlength: 80 },
    score: { type: Number, min: 0, max: 10 },
    evidence: [{ type: String, maxlength: 300 }],
}, { _id: false });

const competencySchema = new mongoose.Schema({
    name: { type: String, maxlength: 80 },
    score: { type: Number, min: 0, max: 10 },
    confidence: { type: Number, min: 0, max: 1 },
    evidence: [{ type: String, maxlength: 300 }],
}, { _id: false });

const feedbackSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            index: true,
        },
        question: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Question",
            required: true,
        },
        comment: { type: String, required: true },
        score: { type: Number, min: 0, max: 10 },
        confidence: { type: Number, min: 0, max: 1 },
        suggestions: [String],
        strengths: [{ type: String, maxlength: 300 }],
        gaps: [{ type: String, maxlength: 300 }],
        dimensions: { type: [dimensionSchema], default: [] },
        competencies: { type: [competencySchema], default: [] },
        evidence: [{ type: String, maxlength: 400 }],
    },
    { timestamps: true }
);

const Feedback = mongoose.model("Feedback", feedbackSchema);
export default Feedback;
