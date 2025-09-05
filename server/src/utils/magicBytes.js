// Simple magic byte validators for common types

export const isPdf = (buf) => {
    if (!buf || buf.length < 4) return false;
    return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46; // %PDF
};

export const isWav = (buf) => {
    if (!buf || buf.length < 12) return false;
    return buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WAVE";
};

export const isMp3 = (buf) => {
    if (!buf || buf.length < 3) return false;
    // ID3 header or MPEG frame sync 0xFF 0xFB/0xF3/0xF2
    if (buf.slice(0, 3).toString("ascii") === "ID3") return true;
    return buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;
};

export const isOgg = (buf) => {
    if (!buf || buf.length < 4) return false;
    return buf.slice(0, 4).toString("ascii") === "OggS";
};

export const isWebm = (buf) => {
    if (!buf || buf.length < 4) return false;
    // EBML header 0x1A45DFA3
    return buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
};

export const assertPdfMagic = (buf) => {
    if (!isPdf(buf)) throw new Error("Invalid PDF file signature");
};

export const assertAudioMagic = (buf, mime) => {
    const m = (mime || "").toLowerCase();
    if (m.includes("wav")) {
        if (!isWav(buf)) throw new Error("Invalid WAV file signature");
        return;
    }
    if (m.includes("mpeg") || m.includes("mp3")) {
        if (!isMp3(buf)) throw new Error("Invalid MP3 file signature");
        return;
    }
    if (m.includes("ogg")) {
        if (!isOgg(buf)) throw new Error("Invalid OGG file signature");
        return;
    }
    if (m.includes("webm")) {
        if (!isWebm(buf)) throw new Error("Invalid WEBM file signature");
        return;
    }
    // For octet-stream or unknown, accept if any known audio magic detected
    if (isWav(buf) || isMp3(buf) || isOgg(buf) || isWebm(buf)) return;
    throw new Error("Unknown or unsupported audio format");
};
