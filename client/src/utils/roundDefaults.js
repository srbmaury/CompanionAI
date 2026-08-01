export const getDefaultQuestionLimit = (round = {}) => {
    const text = `${round.roundName || ""} ${round.description || ""}`.toLowerCase();
    const mode = round.deliveryMode || "conversational";

    if (mode === "online-assessment") return 6;
    if (/coding|data structure|algorithm|system design|architecture|case study|technical assessment/.test(text)) return 3;
    if (/recruiter|screen|behavior|culture|hiring manager/.test(text)) return 5;
    return 4;
};

export default getDefaultQuestionLimit;
