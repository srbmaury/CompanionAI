import jwt from "jsonwebtoken";
import User from "../models/User.js";

const protect = async (req, res, next) => {
    try {
        const authHeader = req.get("authorization") || req.get("Authorization");
        if (!authHeader || !/^bearer\s+/i.test(authHeader)) {
            return res.status(401).json({ message: "Not authorized" });
        }
        const token = authHeader.slice(7).trim();
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select("_id name email role provider preferredProgrammingLanguage practiceGoal targetRole weeklyPracticeTarget reminderEnabled reminderDay reminderTime reminderTimezone plan subscriptionStatus tokenVersion isVerified +billingCustomerId");
        if (!user) return res.status(401).json({ message: "User not found" });
        // Enforce max 1 session by comparing tokenVersion if present in token
        if (decoded.tokenVersion != null && user.tokenVersion !== decoded.tokenVersion) {
            return res.status(401).json({ message: "Session expired" });
        }
        req.user = user;
        if (!req.user) return res.status(401).json({ message: "User not found" });
        return next();
    } catch (error) {
        return res.status(401).json({ message: "Not authorized" });
    }
};

export default protect;
