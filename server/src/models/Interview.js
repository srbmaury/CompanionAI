import mongoose from "mongoose";

const interviewSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        resume: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Resume",
            required: true,
        },
        company: {
            type: String,
            required: true,
        },
        jobRole: {
            type: String,
            required: true,
        },
        jobDescription: {
            type: String,
            required: true,
        },
        rounds: {
            type: [
                {
                    round: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "Round",
                        required: true,
                    },
                },
            ],
            required: true,
        },
        overallScore: { type: Number, default: 0 },
    },
    { timestamps: true }
);

interviewSchema.index({ user: 1, createdAt: -1 });

const Interview = mongoose.model("Interview", interviewSchema);
export default Interview;
