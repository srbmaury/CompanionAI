import metrics from "../metrics/index.js";
import { normalizeRoute } from "../metrics/routes.js";

const requireRole = (role) => (req, res, next) => {
    try {
        if (!req.user || req.user.role !== role) {
            metrics.authorizationDeniedTotal.labels("insufficient_role", normalizeRoute(req)).inc();
            return res.status(403).json({ message: "Forbidden" });
        }
        return next();
    } catch (e) {
        metrics.authorizationDeniedTotal.labels("role_check_error", normalizeRoute(req)).inc();
        return res.status(403).json({ message: "Forbidden" });
    }
};

export default requireRole;
