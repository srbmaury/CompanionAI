import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { rotateRefresh } from "../utils/tokens.js";

const protect = async (req, res, next) => {
    try {
        const access = req.cookies.accessToken;
        if (access) {
            try {
                const decoded = jwt.verify(access, process.env.JWT_SECRET);
                req.user = await User.findById(decoded.id).select("-password");
                if (!req.user) return res.status(401).json({ message: "User not found" });
                return next();
            } catch (e) {
                // fall through to refresh on expiration/invalid
            }
        }

        // Try rotating refresh token to obtain new access
        const userId = await rotateRefresh(req, res);
        if (!userId) return res.status(401).json({ message: "Not authorized" });
        req.user = await User.findById(userId).select("-password");
        if (!req.user) return res.status(401).json({ message: "User not found" });
        return next();
    } catch (error) {
        return res.status(401).json({ message: "Not authorized" });
    }
};

export default protect;
