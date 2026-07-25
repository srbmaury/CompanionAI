import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { assertAudioMagic } from "../utils/magicBytes.js";
import metrics from "../metrics/index.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

export const transcribe = async (req, res, next) => {
    try {
        const file = req.file;
        if (!file || !file.buffer) {
            return res.status(400).json({ message: "Missing audio file" });
        }
        // Validate magic bytes to ensure declared MIME matches real content
        try {
            assertAudioMagic(file.buffer, file.mimetype || "");
        } catch (e) {
            return res.status(400).json({ message: e?.message || "Invalid audio file" });
        }

        // OpenAI Whisper API
        const model = process.env.WHISPER_MODEL_NAME || "whisper-1";
        const typed = await toFile(
            file.buffer,
            file.originalname || "audio.webm",
            { type: file.mimetype || "audio/webm" }
        );

        const resp = await openai.audio.transcriptions.create({
            model,
            file: typed,
            response_format: "json",
            language: "en",
        });

        const text = (resp?.text || "").toString().trim();
        try { metrics.sttTranscribeTotal.labels("success").inc(); } catch {}
        return res.json({ text });
    } catch (error) {
        console.error("whisper transcribe error:", error);
        try { metrics.sttTranscribeTotal.labels("failure").inc(); } catch {}
        return res.status(500).json({ message: "Transcription failed" });
    }
};

export default { transcribe };
