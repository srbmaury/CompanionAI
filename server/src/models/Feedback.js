import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
    {
        question: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Question",
            required: true,
        },
        comment: { type: String, required: true },
        score: { type: Number, min: 0, max: 10 },
        suggestions: [String],
    },
    { timestamps: true }
);

const Feedback = mongoose.model("Feedback", feedbackSchema);
export default Feedback;
