import crypto from "crypto";

const requestId = () => (req, res, next) => {
    const existing = req.get("x-request-id");
    const id = existing && existing.length <= 200 ? existing : crypto.randomUUID();
    req.id = id;
    res.setHeader("x-request-id", id);
    next();
};

export default requestId;