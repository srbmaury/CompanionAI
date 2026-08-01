import { useState, useCallback, useEffect, useRef } from "react";
import api from "../api/axios";

const SpeechRecognitionCtor =
    typeof window !== "undefined"
        ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
        : null;

/**
 * Dual-layer STT: MediaRecorder → Whisper on stop (high quality),
 * with Web Speech API running in parallel for live interim transcript display.
 * On stop, Whisper result wins; if Whisper fails, accumulated Web Speech finals are used.
 */
export const useVoiceInput = ({ onTranscript }) => {
    const [listening, setListening] = useState(false);
    const [listeningTarget, setListeningTarget] = useState(null);
    const [interimText, setInterimText] = useState("");   // live preview while speaking
    const [micLevel, setMicLevel] = useState(0);
    const [micPermission, setMicPermission] = useState("unknown");
    const [inputDevices, setInputDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState("default");

    const mediaRecorderRef = useRef(null);  // MediaRecorder for Whisper audio
    const liveRecRef = useRef(null);        // Web Speech running in parallel for live preview
    const wsFinalsRef = useRef("");         // accumulated finals from parallel Web Speech
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
        try { navigator.mediaDevices?.addEventListener?.("devicechange", updateDevices); } catch { void 0; }
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

    const stopLiveRec = useCallback(() => {
        try { liveRecRef.current?.stop(); } catch { void 0; }
        liveRecRef.current = null;
        setInterimText("");
    }, []);

    // Pure Web Speech fallback (used when getUserMedia is unavailable entirely)
    const fallbackSTT = useCallback(async (target) => {
        try {
            const Rec = SpeechRecognitionCtor;
            if (!Rec) throw new Error("Web Speech not available");
            if (liveRecRef.current) { liveRecRef.current.stop?.(); liveRecRef.current = null; }
            const rec = new Rec();
            rec.lang = "en-US";
            rec.continuous = true;
            rec.interimResults = true;
            rec.onresult = (event) => {
                let finals = "";
                let interim = "";
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const t = event.results[i][0].transcript;
                    if (event.results[i].isFinal) finals += t + " ";
                    else interim += t;
                }
                if (finals.trim()) onTranscriptRef.current?.(target, finals.trim());
                setInterimText(interim);
            };
            rec.onend = () => { setListening(false); setListeningTarget(null); setInterimText(""); };
            rec.onerror = () => { setListening(false); setListeningTarget(null); setInterimText(""); };
            rec.start();
            liveRecRef.current = rec;
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

            // MediaRecorder for Whisper (collects audio chunks)
            let mr;
            try {
                mr = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
            } catch {
                mr = new MediaRecorder(stream);
            }
            const chunks = [];
            wsFinalsRef.current = "";
            mediaRecorderRef.current = mr;

            // Parallel Web Speech for live interim transcript display
            if (SpeechRecognitionCtor) {
                try {
                    const rec = new SpeechRecognitionCtor();
                    rec.lang = "en-US";
                    rec.continuous = true;
                    rec.interimResults = true;
                    rec.onresult = (event) => {
                        let finals = "";
                        let interim = "";
                        for (let i = event.resultIndex; i < event.results.length; i++) {
                            const t = event.results[i][0].transcript;
                            if (event.results[i].isFinal) finals += t + " ";
                            else interim += t;
                        }
                        if (finals) wsFinalsRef.current += finals;
                        setInterimText(interim);
                    };
                    rec.onend = () => setInterimText("");
                    rec.start();
                    liveRecRef.current = rec;
                } catch { /* Web Speech unavailable — no live preview, Whisper still works */ }
            }

            mr.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
            mr.onstop = async () => {
                stopLiveRec();
                // Brief wait to allow the last chunk to flush
                await new Promise((r) => setTimeout(r, 350));
                try {
                    const blob = new Blob(chunks, { type: "audio/webm" });
                    let finalText = "";

                    if (blob.size > 1000) {
                        try {
                            const form = new FormData();
                            form.append("audio", blob, "audio.webm");
                            const resp = await api.post("/stt/transcribe", form, { headers: { "Content-Type": "multipart/form-data" } });
                            finalText = (resp?.data?.text || "").trim();
                        } catch (e) {
                            console.warn("Whisper transcribe failed, using Web Speech fallback", e);
                        }
                    }

                    // Prefer Whisper; fall back to accumulated Web Speech finals
                    if (!finalText) finalText = wsFinalsRef.current.trim();
                    if (finalText) onTranscriptRef.current?.(target, finalText);
                } finally {
                    setListening(false);
                    setListeningTarget(null);
                    try { stopMeter(); } catch { void 0; }
                    try { stream.getTracks().forEach((t) => t.stop()); } catch { void 0; }
                }
            };

            mr.start(250); // chunk every 250ms like OpportunityAgent
            setListening(true);
            setListeningTarget(target);
            startMeter(stream);
        } catch (err) {
            console.debug("getUserMedia failed, falling back to Web Speech", err);
            await fallbackSTT(target);
        }
    }, [fallbackSTT, selectedDeviceId, startMeter, stopMeter, stopLiveRec]);

    const stopListening = useCallback(() => {
        stopLiveRec();
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            try { mediaRecorderRef.current.stop(); } catch (e) { console.debug("stop error", e); }
        }
        mediaRecorderRef.current = null;
        setListening(false);
        setListeningTarget(null);
        try { stopMeter(); } catch { void 0; }
    }, [stopMeter, stopLiveRec]);

    const speakNow = useCallback((text) => {
        try {
            if (!supportsTTS || !text) return;
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.rate = 0.95;
            u.pitch = 1;
            // Prefer a natural-sounding English voice if available
            const voices = window.speechSynthesis.getVoices();
            const preferred =
                voices.find((v) => v.name.includes("Google") && v.lang.startsWith("en")) ||
                voices.find((v) => v.lang.startsWith("en"));
            if (preferred) u.voice = preferred;
            window.speechSynthesis.speak(u);
        } catch (e) {
            console.warn("speakNow error", e);
        }
    }, [supportsTTS]);

    return {
        listening, listeningTarget, interimText,
        micLevel, micPermission,
        inputDevices, selectedDeviceId, setSelectedDeviceId,
        supportsSTT, supportsTTS,
        startListening, stopListening, speakNow,
    };
};
