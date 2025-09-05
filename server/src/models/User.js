import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Name is required"],
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
        },
        password: {
            type: String,
            // Only required for local accounts
            required: function () {
                return this.provider === "local";
            },
        },
        provider: {
            type: String,
            enum: ["local", "google"],
            default: "local",
        },
        googleId: {
            type: String,
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        verificationToken: {
            type: String,
        },
        verificationTokenExpires: {
            type: Date,
        },
        resetPasswordToken: {
            type: String,
        },
        resetPasswordExpires: {
            type: Date,
        },
        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user",
        },
        preferredProgrammingLanguage: {
            type: String,
            enum: ["javascript", "python", "cpp", "java"],
            default: "cpp",
        },
    },
    { timestamps: true }
);

// Encrypt password before save
userSchema.pre("save", async function (next) {
    // Hash password only for local provider and when modified
    if (this.provider !== "local") return next();
    if (!this.isModified("password")) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Match password
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
