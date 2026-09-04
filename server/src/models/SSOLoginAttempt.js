import mongoose from "mongoose";

const ssoLoginAttemptSchema = new mongoose.Schema(
    {
        organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        emailHint: { type: String, required: true, lowercase: true, trim: true },
        stateHash: { type: String, required: true, unique: true, select: false },
        codeVerifier: { type: String, required: true, select: false },
        nonce: { type: String, required: true, select: false },
        exchangeCodeHash: { type: String, default: "", unique: true, sparse: true, select: false },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        status: { type: String, enum: ["started", "authenticated", "exchanged"], default: "started", index: true },
        expiresAt: { type: Date, required: true, index: { expires: 0 } },
    },
    { timestamps: true }
);

export default mongoose.model("SSOLoginAttempt", ssoLoginAttemptSchema);
