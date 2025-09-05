const requireFeature = (flagName) => (req, res, next) => {
    try {
        if ((process.env[flagName] || "").toLowerCase() === "true") return next();
        return res.status(503).json({ message: "Feature disabled" });
    } catch {
        return res.status(503).json({ message: "Feature disabled" });
    }
};

export default requireFeature;
