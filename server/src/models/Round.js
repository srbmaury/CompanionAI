import mongoose from "mongoose";

const followUpSchema = new mongoose.Schema({
    question: { type: String, required: true, maxlength: 1000 },
    answer: { type: String, maxlength: 5000, default: "" },
    reason: { type: String, maxlength: 240, default: "" },
    focus: { type: String, maxlength: 120, default: "" },
    skipped: { type: Boolean, default: false },
    askedAt: { type: Date, default: Date.now },
    answeredAt: { type: Date },
}, { _id: false });

const roundSchema = new mongoose.Schema({
    name: { type: String, required: true },
    nextRound: { type: mongoose.Schema.Types.ObjectId, ref: "Round" },
    description: { type: String, required: true },
    deliveryMode: {
        type: String,
        enum: ["online-assessment", "conversational"],
        default: "conversational",
    },
    conversationalIndex: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ["pending", "in_progress", "completed"],
        default: "pending",
    },
    questionLimit: { type: Number, default: 8 },
    questions: [{
        question: { type: mongoose.Schema.Types.ObjectId, ref: "Question" },
        answerGiven: { type: String },
        followUps: { type: [followUpSchema], default: [] },
        feedback: { type: mongoose.Schema.Types.ObjectId, ref: "Feedback" },
    }],
});

const Round = mongoose.model("Round", roundSchema);
export default Round;
