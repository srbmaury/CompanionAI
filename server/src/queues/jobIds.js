import crypto from "crypto";

export const createJobId = (prefix, parts) => {
    const digest = crypto
        .createHash("sha256")
        .update(JSON.stringify(parts))
        .digest("hex");
    return `${prefix}-${digest}`;
};

export default createJobId;
