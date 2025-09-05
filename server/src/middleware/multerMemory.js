import multer from "multer";

const storage = multer.memoryStorage(); // store file in buffer

const fileFilter = (allowedMimes) => (req, file, cb) => {
    if (!allowedMimes || allowedMimes.length === 0) return cb(null, true);
    if (allowedMimes.includes(file.mimetype)) return cb(null, true);
    return cb(new Error("Unsupported file type"));
};

export const upload = multer({ storage });

export const uploadResumeMulter = multer({
    storage,
    limits: { fileSize: Number(process.env.MAX_RESUME_BYTES || 5 * 1024 * 1024) },
    fileFilter: fileFilter(["application/pdf"]),
});

export const uploadAudioMulter = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: fileFilter([
        "audio/wav",
        "audio/x-wav",
        "audio/mpeg",
        "audio/ogg",
        "audio/webm",
        "application/octet-stream", // some browsers send generic type; validate length limit instead
    ]),
});
