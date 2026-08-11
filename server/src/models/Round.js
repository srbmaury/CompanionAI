import mongoose from "mongoose";

const roundSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    nextRound: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Round",
    },
    description: {
        type: String,
        required: true,
    },
    // Delivery mode determines how questions are presented to the candidate
    // "online-assessment" => all questions at once, "conversational" => one-by-one flow
    deliveryMode: {
        type: String,
        enum: ["online-assessment", "conversational"],
        default: "conversational",
    },
    // Tracks progress for conversational rounds
    conversationalIndex: { type: Number, default: 0 },
    // Round lifecycle: governs when next rounds can start
    status: {
        type: String,
        enum: ["pending", "in_progress", "completed"],
        default: "pending",
    },
    // Maximum number of questions for the round
    questionLimit: { type: Number, default: 8 },
    questions: [
        {
            question: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Question",
            },
            answerGiven: { type: String },
            followUpQuestion: { type: String, maxlength: 1000 },
            followUpAnswer: { type: String, maxlength: 5000 },
            feedback: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Feedback",
            },
        },
    ],
});

const Round = mongoose.model("Round", roundSchema);
export default Round;
