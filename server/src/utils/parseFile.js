import pdfParse from "pdf-parse";

/**
 * Parse uploaded resume buffer
 * @param {Buffer} buffer - File buffer from multer
 * @param {string} mimetype - File mimetype
 * @returns {Promise<string>} Extracted text content
 */
export async function parseFile(buffer, mimetype) {
    if (!buffer) {
        throw new Error("No file buffer provided");
    }

    if (mimetype !== "application/pdf") {
        throw new Error("Only PDF resumes are supported");
    }

    // Extract text from PDF
    const pdfData = await pdfParse(buffer);

    return pdfData.text; // full text
}
