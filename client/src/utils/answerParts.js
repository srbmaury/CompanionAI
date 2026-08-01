export const composeAnswerParts = (written, spoken) => {
    const writtenText = (written || "").trim();
    const spokenText = (spoken || "").trim();
    if (!spokenText) return writtenText;
    if (!writtenText) return spokenText;
    return `Written/code answer:\n${writtenText}\n\nSpoken explanation:\n${spokenText}`;
};
