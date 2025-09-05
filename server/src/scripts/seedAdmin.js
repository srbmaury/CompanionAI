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
    const email = getArg("email") || process.env.ADMIN_EMAIL;
    const name = getArg("name") || process.env.ADMIN_NAME || "Admin";
    const password = getArg("password") || process.env.ADMIN_PASSWORD;
    if (!email || !password) {
        console.error("Missing required email/password. Provide --email and --password or set ADMIN_EMAIL/ADMIN_PASSWORD env vars.");
        process.exit(1);
    }

    await connectDB();
    try {
        let user = await User.findOne({ email });
        if (!user) {
            user = await User.create({ name, email, password, provider: "local", isVerified: true, role: "admin" });
            console.log(`Created admin user ${email}`);
        } else {
            user.name = name || user.name;
            if (password) user.password = password;
            user.provider = user.provider || "local";
            user.isVerified = true;
            user.role = "admin";
            await user.save();
            console.log(`Promoted existing user ${email} to admin`);
        }
    } catch (e) {
        console.error("Seed admin failed:", e?.message || e);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
    }
};

run();