import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/User.js";

dotenv.config();

const getArg = (name) => {
    const prefix = `--${name}=`;
    const arg = process.argv.find((a) => a.startsWith(prefix));
    return arg ? arg.slice(prefix.length) : undefined;
};

const run = async () => {
    const email = (getArg("email") || process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const name = getArg("name") || process.env.ADMIN_NAME || "Admin";
    const password = getArg("password") || process.env.ADMIN_PASSWORD;
    if (!email) {
        console.error("Missing required email. Provide --email or set ADMIN_EMAIL.");
        process.exit(1);
    }

    await connectDB();
    try {
        let user = await User.findOne({ email });
        if (!user) {
            if (!password) {
                console.error("No existing user found. A password is required only when creating a new local admin account.");
                process.exitCode = 1;
                return;
            }
            user = await User.create({ name, email, password, provider: "local", isVerified: true, role: "admin" });
            console.log(`Created admin user ${email}`);
        } else {
            user.isVerified = true;
            user.role = "admin";
            await user.save();
            console.log(`Promoted existing user ${email} to admin`);
        }
    } catch (e) {
        console.error("Seed admin failed:", e?.message || e);
        process.exitCode = 1;
    } finally {
        await mongoose.connection.close();
    }
};

run();