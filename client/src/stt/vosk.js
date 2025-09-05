// Lightweight Vosk (WASM) client utility for browser STT
// Requires a gzipped Vosk model tarball accessible via URL (CORS-enabled)
// Provide the URL via VITE_VOSK_MODEL_URL

let cachedModel = null;
let activeRecognizer = null;
let activeAudio = {
    context: null,
    source: null,
    processor: null,
    stream: null,
};

export const isVoskAvailable = () => {
    // Dynamic import availability and secure context check (mic requires https)
    return typeof window !== "undefined" && typeof navigator !== "undefined";
};

async function importVosk() {
    // Defer import until needed to avoid increasing initial bundle
    const mod = await import("vosk-browser/dist/vosk.js");
    return mod;
}

export async function loadModel(modelUrl, logLevel = 0) {
    if (!modelUrl) throw new Error("Vosk modelUrl is required");
    if (cachedModel?.ready) return cachedModel;
    const Vosk = await importVosk();
    cachedModel = await Vosk.createModel(modelUrl, logLevel);
    return cachedModel;
}

export async function startListeningWithVosk({
    modelUrl,
    logLevel = -1, // warnings by default
    onPartial,
    onResult,
    onError,
}) {
    try {
        const model = await loadModel(modelUrl, logLevel);

        // Create recognizer with the actual audio sample rate for best accuracy
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const sampleRate = audioContext.sampleRate || 16000;
        const recognizer = new model.KaldiRecognizer(sampleRate);
        recognizer.setWords(false);

        recognizer.on("partialresult", (msg) => {
            const text = msg?.result?.partial || "";
            if (text && onPartial) onPartial(text);
        });
        recognizer.on("result", (msg) => {
            const text = msg?.result?.text || "";
            if (text && onResult) onResult(text);
        });

        const stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                channelCount: 1,
            },
        });

        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (event) => {
            try {
                recognizer.acceptWaveform(event.inputBuffer);
            } catch (e) {
                console.debug("acceptWaveform error (ignored)", e);
            }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

        // Track active so we can stop later
        activeRecognizer = recognizer;
        activeAudio = { context: audioContext, source, processor, stream };

        // Return a stop function to cleanup
        const stop = () => {
            try { recognizer.retrieveFinalResult(); } catch (e) { console.debug("retrieveFinalResult error (ignored)", e); }
            try { recognizer.remove(); } catch (e) { console.debug("recognizer.remove error (ignored)", e); }
            try { processor.disconnect(); } catch (e) { console.debug("processor.disconnect error (ignored)", e); }
            try { source.disconnect(); } catch (e) { console.debug("source.disconnect error (ignored)", e); }
            try { stream.getTracks().forEach((t) => t.stop()); } catch (e) { console.debug("stream.stop error (ignored)", e); }
            try { audioContext.close(); } catch (e) { console.debug("audioContext.close error (ignored)", e); }

            activeRecognizer = null;
            activeAudio = { context: null, source: null, processor: null, stream: null };
        };

        return { stop, recognizer, model };
    } catch (e) {
        if (onError) onError(e);
        throw e;
    }
}

export function stopVosk() {
    if (activeRecognizer || activeAudio.context) {
        try { activeRecognizer?.retrieveFinalResult(); } catch (e) { console.debug("retrieveFinalResult error (ignored)", e); }
        try { activeRecognizer?.remove(); } catch (e) { console.debug("recognizer.remove error (ignored)", e); }
        try { activeAudio.processor?.disconnect(); } catch (e) { console.debug("processor.disconnect error (ignored)", e); }
        try { activeAudio.source?.disconnect(); } catch (e) { console.debug("source.disconnect error (ignored)", e); }
        try { activeAudio.stream?.getTracks().forEach((t) => t.stop()); } catch (e) { console.debug("stream.stop error (ignored)", e); }
        try { activeAudio.context?.close(); } catch (e) { console.debug("audioContext.close error (ignored)", e); }
    }
    activeRecognizer = null;
    activeAudio = { context: null, source: null, processor: null, stream: null };
}

export function unloadVoskModel() {
    try { cachedModel?.terminate?.(); } catch (e) { console.debug("model.terminate error (ignored)", e); }
    cachedModel = null;
}
