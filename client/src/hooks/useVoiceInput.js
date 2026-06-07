import { useState, useCallback, useEffect, useRef } from "react";
import api from "../api/axios";
import { isVoskAvailable, startListeningWithVosk } from "../stt/vosk";

const SpeechRecognitionCtor =
    typeof window !== "undefined"
        ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
        : null;

const voskModelUrl = import.meta?.env?.VITE_VOSK_MODEL_URL || undefined;

/**
 * Handles all voice I/O: microphone access, Whisper STT (with Vosk / Web Speech fallback),
 * audio level metering, and browser TTS.
 *
 * @param {{ onTranscript: (target: "conv" | number, text: string) => void }} params
 */
export const useVoiceInput = ({ onTranscript }) => {
    const [listening, setListening] = useState(false);
    const [listeningTarget, setListeningTarget] = useState(null);
    const [micLevel, setMicLevel] = useState(0);
    const [micPermission, setMicPermission] = useState("unknown");
    const [inputDevices, setInputDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState("default");

    const recognitionRef = useRef(null);
    const voskStopRef = useRef(null);
    const lastResultIndexRef = useRef(0);
    const audioCtxRef = useRef(null);
    const analyserRef = useRef(null);
    const rafRef = useRef(null);
    const onTranscriptRef = useRef(onTranscript);
    useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);

    const supportsTTS = typeof window !== "undefined" && "speechSynthesis" in window;
    const supportsSTT = true;

    // Mic permissions + device enumeration
    useEffect(() => {
        const updateDevices = async () => {
            try {
                if (!navigator.mediaDevices?.enumerateDevices) return;
                const devs = await navigator.mediaDevices.enumerateDevices();
                setInputDevices(devs.filter((d) => d.kind === "audioinput").map((d) => ({ deviceId: d.deviceId, label: d.label })));
            } catch { void 0; }
        };
        updateDevices();
        try {
            navigator.mediaDevices?.addEventListener?.("devicechange", updateDevices);
        } catch { void 0; }
        try {
            if (navigator.permissions?.query) {
                navigator.permissions.query({ name: "microphone" }).then((status) => {
                    setMicPermission(status.state || "unknown");
                    status.onchange = () => setMicPermission(status.state || "unknown");
                }).catch(() => setMicPermission("unknown"));
            }
        } catch { setMicPermission("unknown"); }
        return () => {
            try { navigator.mediaDevices?.removeEventListener?.("devicechange", updateDevices); } catch { void 0; }
        };
    }, []);

    const startMeter = useCallback((stream) => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            audioCtxRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 1024;
            analyserRef.current = analyser;
            source.connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);
            const tick = () => {
                try {
                    analyser.getByteTimeDomainData(data);
                    let sum = 0;
                    for (let i = 0; i < data.length; i++) {
                        const v = (data[i] - 128) / 128;
                        sum += v * v;
                    }
                    const rms = Math.sqrt(sum / data.length);
                    setMicLevel(isFinite(rms) ? Math.min(1, Math.max(0, rms * 2)) : 0);
                } catch { void 0; }
                rafRef.current = requestAnimationFrame(tick);
            };
            rafRef.current = requestAnimationFrame(tick);
        } catch { void 0; }
    }, []);

    const stopMeter = useCallback(() => {
        try { if (rafRef.current) cancelAnimationFrame(rafRef.current); } catch { void 0; }
        rafRef.current = null;
        try { analyserRef.current?.disconnect?.(); } catch { void 0; }
        analyserRef.current = null;
        try { audioCtxRef.current?.close?.(); } catch { void 0; }
        audioCtxRef.current = null;
        setMicLevel(0);
    }, []);

    const fallbackSTT = useCallback(async (target) => {
        // Try Vosk first
        if (isVoskAvailable() && voskModelUrl) {
            try {
                const session = await startListeningWithVosk({
                    modelUrl: voskModelUrl,
                    onResult: (text) => {
                        if (text) onTranscriptRef.current?.(target, text.trim());
                    },
                    onError: () => { setListening(false); setListeningTarget(null); },
                });
                voskStopRef.current = session.stop;
                setListening(true);
                setListeningTarget(target);
                return;
            } catch (e) {
                console.warn("Vosk fallback failed", e);
            }
        }
        // Web Speech API fallback
        try {
            const Rec = SpeechRecognitionCtor;
            if (!Rec) throw new Error("Web Speech not available");
            if (recognitionRef.current) { recognitionRef.current.stop?.(); recognitionRef.current = null; }
            const rec = new Rec();
            rec.lang = "en-US";
            rec.continuous = true;
            rec.interimResults = true;
            lastResultIndexRef.current = 0;
            rec.onresult = (event) => {
                let appended = "";
                for (let i = lastResultIndexRef.current; i < event.results.length; i++) {
                    const res = event.results[i];
                    if (res?.[0]) appended += res[0].transcript;
                }
                if (appended) onTranscriptRef.current?.(target, appended.trim());
                lastResultIndexRef.current = event.results.length;
            };
            rec.onend = () => { setListening(false); setListeningTarget(null); };
            rec.onerror = () => { setListening(false); setListeningTarget(null); };
            rec.start();
            recognitionRef.current = rec;
            setListening(true);
            setListeningTarget(target);
        } catch (err) {
            console.debug("Web Speech start error (ignored)", err);
            setListening(false);
            setListeningTarget(null);
        }
    }, []);

    const startListening = useCallback(async (target) => {
        try {
            const constraints = selectedDeviceId && selectedDeviceId !== "default"
                ? { audio: { deviceId: { exact: selectedDeviceId } }, video: false }
                : { audio: true, video: false };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
            const chunks = [];
            mediaRecorder.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
            mediaRecorder.onstop = async () => {
                try {
                    const blob = new Blob(chunks, { type: "audio/webm" });
                    const form = new FormData();
                    form.append("audio", blob, "audio.webm");
                    const resp = await api.post("/stt/transcribe", form, { headers: { "Content-Type": "multipart/form-data" } });
                    const text = (resp?.data?.text || "").trim();
                    if (text) onTranscriptRef.current?.(target, text);
                } catch (e) {
                    console.warn("whisper transcribe failed, trying fallback", e);
                    await fallbackSTT(target);
                } finally {
                    setListening(false);
                    setListeningTarget(null);
                    try { stopMeter(); } catch { void 0; }
                    try { stream.getTracks().forEach((t) => t.stop()); } catch { void 0; }
                }
            };
            mediaRecorder.start();
            recognitionRef.current = { stop: () => mediaRecorder.stop() };
            setListening(true);
            setListeningTarget(target);
            startMeter(stream);
        } catch (err) {
            console.debug("whisper start error", err);
            await fallbackSTT(target);
        }
    }, [fallbackSTT, selectedDeviceId, startMeter, stopMeter]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current?.stop) {
            try { recognitionRef.current.stop(); } catch (e) { console.debug("stop error", e); }
        }
        if (voskStopRef.current) {
            try { voskStopRef.current(); } catch { void 0; }
            voskStopRef.current = null;
        }
        recognitionRef.current = null;
        setListening(false);
        setListeningTarget(null);
        try { stopMeter(); } catch { void 0; }
    }, [stopMeter]);

    const speakNow = useCallback((text) => {
        try {
            if (!supportsTTS || !text) return;
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.rate = 1;
            u.pitch = 1;
            window.speechSynthesis.speak(u);
        } catch (e) {
            console.warn("speakNow error", e);
        }
    }, [supportsTTS]);

    return {
        listening, listeningTarget,
        micLevel, micPermission,
        inputDevices, selectedDeviceId, setSelectedDeviceId,
        supportsSTT, supportsTTS,
        startListening, stopListening, speakNow,
    };
};
