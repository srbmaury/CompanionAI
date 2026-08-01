import mongoose from "mongoose";

const savedExperienceSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    url: { type: String, required: true, maxlength: 2000 },
    snippet: { type: String, default: "", maxlength: 1000 },
    company: { type: String, required: true, maxlength: 120 },
    role: { type: String, required: true, maxlength: 120 },
}, { timestamps: true });

savedExperienceSchema.index({ user: 1, url: 1 }, { unique: true });

export default mongoose.model("SavedExperience", savedExperienceSchema);
