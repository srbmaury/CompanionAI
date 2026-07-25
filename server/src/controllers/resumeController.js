import Resume from "../models/Resume.js";
import cloudinary from "../config/cloudinaryConfig.js";
import streamifier from "streamifier";
import { parseFile } from "../utils/parseFile.js";
import https from "https";
import { assertPdfMagic } from "../utils/magicBytes.js";
import metrics from "../metrics/index.js";
import { generateJSON } from "../utils/generateQuestions/aiClient.js";

// Align with multer filter (PDF only) and use single source of truth for max bytes
const ALLOWED_MIME = ["application/pdf"];
const MAX_BYTES = Number(process.env.MAX_RESUME_BYTES || 5 * 1024 * 1024); // default 5MB

const optionalAntivirusScan = async (buffer) => {
    if (process.env.ENABLE_AV_SCAN !== "true") return { clean: true };
    try {
        const url = process.env.AV_SCAN_URL;
        if (!url) return { clean: true };
        const resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: buffer,
        });
        if (!resp.ok) return { clean: false, reason: `scanner_http_${resp.status}` };
        const data = await resp.json().catch(() => ({}));
        // expected response: { clean: boolean, reason?: string }
        if (typeof data.clean === "boolean") return { clean: !!data.clean, reason: data.reason };
        return { clean: true };
    } catch (e) {
        // fail closed or open? Choose closed for security
        return { clean: false, reason: "scanner_error" };
    }
};

// Upload resume
export const uploadResume = async (req, res, next) => {
    try {
        if (!req.file)
            return res.status(400).json({ message: "No file uploaded" });

        if (!ALLOWED_MIME.includes(req.file.mimetype)) {
            return res.status(400).json({ message: "Unsupported file type" });
        }
        if (req.file.size > MAX_BYTES) {
            return res.status(400).json({ message: "File too large" });
        }
        try {
            if (req.file.mimetype === "application/pdf") {
                assertPdfMagic(req.file.buffer);
            }
        } catch (e) {
            return res.status(400).json({ message: e?.message || "Invalid file" });
        }
        const av = await optionalAntivirusScan(req.file.buffer);
        if (!av.clean) {
            return res.status(400).json({ message: "File failed security scan" });
        }

        // Extract text from file buffer
        const extractedText = await parseFile(req.file.buffer, req.file.mimetype);

        // Upload to Cloudinary
        const streamUpload = (fileBuffer) => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        resource_type: "raw",
                        folder: "resumes",
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                streamifier.createReadStream(fileBuffer).pipe(stream);
            });
        };

        const uploaded = await streamUpload(req.file.buffer);
        try { metrics.uploadResumeTotal.labels("success").inc(); } catch {}

        // Save resume in DB
        const resume = await Resume.create({
            user: req.user._id,
            fileUrl: uploaded.secure_url,
            publicId: uploaded.public_id,
            fileName: req.file.originalname,
            fileType: req.file.mimetype,
            fileSize: req.file.size,
            extractedText,
        });

        res.status(201).json(resume);
    } catch (error) {
        console.error("Resume upload error:", error);
        try { metrics.uploadResumeTotal.labels("failure").inc(); } catch {}
        return next(error instanceof Error ? error : new Error(String(error)));
    }
};

// Fetch all resumes for a user
export const getUserResumes = async (req, res, next) => {
    try {
        const { sort = "-createdAt", tag, q } = req.query || {};
        const query = { user: req.user._id };
        if (tag) query.tags = tag;
        if (q) query.$or = [
            { fileName: new RegExp(q, "i") },
            { notes: new RegExp(q, "i") },
        ];
        const sortSpec = {};
        const field = sort.replace(/^-/, "");
        const dir = sort.startsWith("-") ? -1 : 1;
        if (["createdAt", "fileName"].includes(field)) sortSpec[field] = dir;

        const resumes = await Resume.find(query).sort(sortSpec).lean();
        res.json(resumes);
    } catch (error) {
        console.error("Fetch resumes error:", error);
        return next(error instanceof Error ? error : new Error(String(error)));
    }
};

// Delete resume
export const deleteResume = async (req, res, next) => {
    try {
        const resume = await Resume.findOne({
            _id: req.params.id,
            user: req.user._id,
        });
        if (!resume)
            return res.status(404).json({ message: "Resume not found" });

        // Remove from Cloudinary (raw resource)
        try {
            if (resume.publicId) {
                await cloudinary.uploader.destroy(resume.publicId, { resource_type: "raw" });
            }
        } catch (e) {
            console.warn("Cloudinary destroy failed:", e?.message || e);
        }

        await Resume.deleteOne({ _id: req.params.id });
        res.json({ message: "Resume deleted" });
    } catch (error) {
        console.error("Delete resume error:", error);
        return next(error instanceof Error ? error : new Error(String(error)));
    }
};

// View resume
export const viewResume = async (req, res, next) => {
    try {
        const resume = await Resume.findOne({ _id: req.params.id, user: req.user._id });
        if (!resume) return res.status(404).json({ message: "Resume not found" });
        res.json(resume);
    } catch (error) {
        console.error("View resume error:", error);
        return next(error instanceof Error ? error : new Error(String(error)));
    }
};

// Stream PDF inline for preview
export const previewResume = async (req, res, next) => {
    try {
        const resume = await Resume.findOne({ _id: req.params.id, user: req.user._id });
        if (!resume) return res.status(404).json({ message: "Resume not found" });
        if (resume.fileType !== "application/pdf") {
            return res.status(400).json({ message: "Preview available for PDFs only" });
        }
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${resume.fileName || "resume.pdf"}"`);
        const reqTimeoutMs = Math.max(parseInt(process.env.RESUME_PREVIEW_TIMEOUT_MS || "10000", 10) || 10000, 1000);
        const httpReq = https.get(resume.fileUrl, (r) => {
            if (r.statusCode && r.statusCode >= 400) {
                res.status(r.statusCode).end();
                return;
            }
            r.pipe(res);
        }).on("error", (err) => {
            console.error("Preview stream error:", err);
            res.status(500).end();
        });
        httpReq.setTimeout(reqTimeoutMs, () => {
            try { httpReq.destroy(new Error("preview_timeout")); } catch {}
            try { if (!res.headersSent) res.status(504).end(); } catch {}
        });
    } catch (error) {
        console.error("Preview resume error:", error);
        return next(error instanceof Error ? error : new Error(String(error)));
    }
};
// Update resume metadata (rename, tags, notes)
export const updateResume = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { fileName, tags, notes } = req.body || {};
        const resume = await Resume.findOne({ _id: id, user: req.user._id });
        if (!resume) return res.status(404).json({ message: "Resume not found" });

        if (typeof fileName === "string" && fileName.trim()) {
            resume.fileName = fileName.trim();
        }
        if (Array.isArray(tags)) {
            resume.tags = tags.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim());
        }
        if (typeof notes === "string") {
            resume.notes = notes;
        }
        await resume.save();
        res.json(resume);
    } catch (error) {
        console.error("Update resume error:", error);
        return next(error instanceof Error ? error : new Error(String(error)));
    }
};

// Generate AI review for a resume
export const reviewResume = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { role, jobDescription } = req.body || {};

        // role and jobDescription are optional; AI will infer based on resume when missing

        const resume = await Resume.findOne({ _id: id, user: req.user._id });
        if (!resume) return res.status(404).json({ message: "Resume not found" });

        const resumeText = (resume.extractedText || "").toString().slice(0, 30000);
        const safeRole = (role || "").toString().slice(0, 200);
        const safeJD = (jobDescription || "").toString().slice(0, 12000);

        const prompt = `You are an expert technical recruiter and hiring manager.
Return ONLY JSON with this exact shape:
{
  "summary": string,
  "atsScore": number, // 0-100
  "strengths": string[], // max 8
  "gaps": string[], // max 8
  "keywordsMatched": string[], // max 20
  "improvementSuggestions": string[], // max 8
  "roleAlignment": string
}
Use clear, concise language. No markdown. No code fences. Be constructive.

ROLE: ${safeRole || "(not provided)"}
JOB_DESCRIPTION: ${safeJD || "(not provided)"}
RESUME_TEXT: ${resumeText}`;

        let json = await generateJSON(prompt);
        if (!json) json = "{}";
        let parsed;
        try { parsed = JSON.parse(json); } catch (_) { parsed = {}; }

        // Normalize result
        const response = {
            summary: (parsed?.summary || "Review unavailable.").toString().slice(0, 2000),
            atsScore: Math.max(0, Math.min(100, Number(parsed?.atsScore) || 0)),
            strengths: Array.isArray(parsed?.strengths) ? parsed.strengths.map((s) => (s || "").toString().slice(0, 200)).filter(Boolean).slice(0, 8) : [],
            gaps: Array.isArray(parsed?.gaps) ? parsed.gaps.map((s) => (s || "").toString().slice(0, 200)).filter(Boolean).slice(0, 8) : [],
            keywordsMatched: Array.isArray(parsed?.keywordsMatched) ? parsed.keywordsMatched.map((s) => (s || "").toString().slice(0, 80)).filter(Boolean).slice(0, 20) : [],
            improvementSuggestions: Array.isArray(parsed?.improvementSuggestions) ? parsed.improvementSuggestions.map((s) => (s || "").toString().slice(0, 200)).filter(Boolean).slice(0, 8) : [],
            roleAlignment: (parsed?.roleAlignment || "").toString().slice(0, 2000),
        };

        res.json(response);
    } catch (error) {
        console.error("Review resume error:", error);
        return next(error instanceof Error ? error : new Error(String(error)));
    }
};
