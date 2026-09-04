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

const evidenceSchema = new mongoose.Schema({
    text: { type: String, maxlength: 500, default: "" },
    score: { type: Number, min: 0, max: 10 },
    confidence: { type: Number, min: 0, max: 1 },
    questionIndex: { type: Number, min: 0 },
    createdAt: { type: Date, default: Date.now },
}, { _id: false });

const competencySchema = new mongoose.Schema({
    name: { type: String, required: true, maxlength: 80 },
    description: { type: String, maxlength: 240, default: "" },
    weight: { type: Number, min: 0.1, max: 3, default: 1 },
    scoreEstimate: { type: Number, min: 0, max: 10, default: null },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    evidenceCount: { type: Number, min: 0, default: 0 },
    coverage: {
        type: String,
        enum: ["uncovered", "partial", "covered"],
        default: "uncovered",
    },
    evidence: { type: [evidenceSchema], default: [] },
    updatedAt: { type: Date },
}, { _id: false });

const resumeClaimSchema = new mongoose.Schema({
    claim: { type: String, required: true, maxlength: 500 },
    topics: [{ type: String, maxlength: 80 }],
    probeAreas: [{ type: String, maxlength: 120 }],
    probeCount: { type: Number, min: 0, default: 0 },
    covered: { type: Boolean, default: false },
}, { _id: false });

const policyDecisionSchema = new mongoose.Schema({
    action: {
        type: String,
        enum: ["next-question", "end-round", "continue"],
        default: "continue",
    },
    targetCompetency: { type: String, maxlength: 80, default: "" },
    sourceClaim: { type: String, maxlength: 500, default: "" },
    reason: { type: String, maxlength: 500, default: "" },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    difficulty: { type: Number, min: 1, max: 5, default: 3 },
    decidedAt: { type: Date, default: Date.now },
}, { _id: false });

const adaptiveStateSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    minQuestions: { type: Number, min: 1, max: 20, default: 2 },
    maxQuestions: { type: Number, min: 1, max: 20, default: 5 },
    currentDifficulty: { type: Number, min: 1, max: 5, default: 3 },
    questionsAsked: { type: Number, min: 0, default: 0 },
    competencies: { type: [competencySchema], default: [] },
    resumeClaims: { type: [resumeClaimSchema], default: [] },
    lastDecision: { type: policyDecisionSchema, default: () => ({}) },
    completedReason: { type: String, maxlength: 500, default: "" },
    initializedAt: { type: Date },
    updatedAt: { type: Date },
}, { _id: false });

const evaluationDimensionSchema = new mongoose.Schema({
    name: { type: String, maxlength: 80 },
    score: { type: Number, min: 0, max: 10 },
    evidence: [{ type: String, maxlength: 300 }],
}, { _id: false });

const competencyEvidenceSchema = new mongoose.Schema({
    name: { type: String, maxlength: 80 },
    score: { type: Number, min: 0, max: 10 },
    confidence: { type: Number, min: 0, max: 1 },
    evidence: [{ type: String, maxlength: 300 }],
}, { _id: false });

const quickEvaluationSchema = new mongoose.Schema({
    overallScore: { type: Number, min: 0, max: 10 },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    dimensions: { type: [evaluationDimensionSchema], default: [] },
    competencyEvidence: { type: [competencyEvidenceSchema], default: [] },
    strengths: [{ type: String, maxlength: 300 }],
    gaps: [{ type: String, maxlength: 300 }],
    evaluatedAt: { type: Date },
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
    skills: [{ type: String, maxlength: 80 }],
    rationale: { type: String, maxlength: 300, default: "" },
    recommended: { type: Boolean, default: true },
    conversationalIndex: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ["pending", "in_progress", "completed"],
        default: "pending",
    },
    questionLimit: { type: Number, default: 8 },
    adaptiveState: { type: adaptiveStateSchema, default: () => ({}) },
    questions: [{
        question: { type: mongoose.Schema.Types.ObjectId, ref: "Question" },
        answerGiven: { type: String },
        followUps: { type: [followUpSchema], default: [] },
        difficulty: { type: Number, min: 1, max: 5, default: 3 },
        competencies: [{ type: String, maxlength: 80 }],
        sourceType: {
            type: String,
            enum: ["planned", "adaptive", "resume-claim", "fallback"],
            default: "planned",
        },
        sourceClaim: { type: String, maxlength: 500, default: "" },
        quickEvaluation: { type: quickEvaluationSchema, default: undefined },
        feedback: { type: mongoose.Schema.Types.ObjectId, ref: "Feedback" },
    }],
});

const Round = mongoose.model("Round", roundSchema);
export default Round;
