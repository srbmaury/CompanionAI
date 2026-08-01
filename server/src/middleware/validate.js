import { ZodError } from "zod";

const formatZodError = (error) => {
    try {
        return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    } catch {
        return [{ path: "unknown", message: "Validation error" }];
    }
};

// validate(schema, source) where source is one of: 'body' | 'query' | 'params'
const validate = (schema, source = "body") => {
    return (req, res, next) => {
        try {
            const result = schema.safeParse(req[source]);
            if (!result.success) {
                const details = formatZodError(result.error);
                return res.status(400).json({ message: "Invalid request", details });
            }
            // replace with parsed values (trimmed, coerced, etc.)
            // Avoid reassigning req.query/req.params in Express 5 (getter-only) – mutate instead
            if (source === "query" || source === "params") {
                const target = req[source] || {};
                try {
                    // clear existing keys
                    for (const key of Object.keys(target)) delete target[key];
                } catch {}
                Object.assign(target, result.data);
            } else {
                req[source] = result.data;
            }
            // Auth-related responses should be non-cacheable
            try {
                if (req.path.startsWith("/api/auth")) {
                    res.setHeader("Cache-Control", "no-store");
                }
            } catch {}
            next();
        } catch (err) {
            if (err instanceof ZodError) {
                const details = formatZodError(err);
                return res.status(400).json({ message: "Invalid request", details });
            }
            next(err);
        }
    };
};

export default validate;
