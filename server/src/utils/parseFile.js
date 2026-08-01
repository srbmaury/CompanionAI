import { PDFParse } from "pdf-parse";

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

    const parser = new PDFParse({ data: buffer });
    try {
        const pdfData = await parser.getText();
        return pdfData.text;
    } finally {
        await parser.destroy();
    }
}
