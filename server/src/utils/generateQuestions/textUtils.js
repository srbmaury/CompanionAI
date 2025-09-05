export const normalize = (s) =>
    (s || "")
        .toString()
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
        .replace(/[^a-z0-9+#.\-\s]/g, "")
        .trim();

export const sanitizeText = (text, maxLen) =>
    (text || "")
        .toString()
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, Math.max(0, maxLen || 4000));
