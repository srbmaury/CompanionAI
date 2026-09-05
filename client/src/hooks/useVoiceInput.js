import { useState, useCallback, useEffect, useRef } from "react";
import api from "../api/axios";

const SpeechRecognitionCtor =
    typeof window !== "undefined"
        ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
        : null;

const HANDS_FREE_SEGMENT_MS = 15000;

export const composeLiveTranscript = (finalText, interimText) => `${finalText || ""} ${interimText || ""}`.trim();

/**
 * Voice input supports two modes:
 * 1. One-shot recording for written/OA answers.
 * 2. A hands-free interview session that keeps the microphone stream alive for
 *    the whole round while pausing transcription during interviewer speech.
 *
 * Browser speech recognition supplies low-latency live text when available.
 * MediaRecorder + server transcription remains the quality/fallback layer.
 */
export const useVoiceInput = ({ onTranscript, transcribeEndpoint = "/stt/transcribe", transcribeHeaders = {}, enableServerTranscription = true, skipAuthRedirect = false }) => {
    const [listening, setListening] = useState(false);
    const [listeningTarget, setListeningTarget] = useState(null);
    const [interimText, setInterimText] = useState("");
    const [micLevel, setMicLevel] = useState(0);
    const [micPermission, setMicPermission] = useState("unknown");
    const [inputDevices, setInputDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState("default");
    const [micSessionActive, setMicSessionActive] = useState(false);
    const [handsFreePaused, setHandsFreePaused] = useState(false);

    const mediaRecorderRef = useRef(null);
    const liveRecRef = useRef(null);
    const liveRecExpectedStopRef = useRef(false);
    const liveRecRestartTimerRef = useRef(null);
    const recorderRotateTimerRef = useRef(null);
    const recorderStopReasonRef = useRef("manual");
    const sessionStreamRef = useRef(null);
    const handsFreeRef = useRef(false);
    const handsFreePausedRef = useRef(false);
    const activeTargetRef = useRef(null);
    const wsFinalsRef = useRef("");
    const wsInterimRef = useRef("");
    const liveTranscriptCommittedRef = useRef(false);
    const audioCtxRef = useRef(null);
    const analyserRef = useRef(null);
    const rafRef = useRef(null);
    const onTranscriptRef = useRef(onTranscript);
    useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);

    const supportsTTS = typeof window !== "undefined" && "speechSynthesis" in window;
    const supportsSTT = enableServerTranscription || Boolean(SpeechRecognitionCtor);

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

    const constraintsForDevice = useCallback(() => selectedDeviceId && selectedDeviceId !== "default"
        ? { audio: { deviceId: { exact: selectedDeviceId } }, video: false }
        : { audio: true, video: false }, [selectedDeviceId]);

    const startMeter = useCallback((stream) => {
        if (!stream || audioCtxRef.current) return;
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

    const clearRotateTimer = useCallback(() => {
        if (recorderRotateTimerRef.current) clearTimeout(recorderRotateTimerRef.current);
        recorderRotateTimerRef.current = null;
    }, []);

    const clearLiveRestartTimer = useCallback(() => {
        if (liveRecRestartTimerRef.current) clearTimeout(liveRecRestartTimerRef.current);
        liveRecRestartTimerRef.current = null;
    }, []);

    const commitLiveTranscript = useCallback((target = activeTargetRef.current) => {
        const text = composeLiveTranscript(wsFinalsRef.current, wsInterimRef.current);
        if (!text || liveTranscriptCommittedRef.current) return false;
        liveTranscriptCommittedRef.current = true;
        onTranscriptRef.current?.(target, text);
        return true;
    }, []);

    const stopLiveRec = useCallback((expected = true) => {
        clearLiveRestartTimer();
        liveRecExpectedStopRef.current = expected;
        try { liveRecRef.current?.stop(); } catch { void 0; }
        liveRecRef.current = null;
        setInterimText("");
    }, [clearLiveRestartTimer]);

    const startLiveRecognition = useCallback((target, restartable = false) => {
        if (!SpeechRecognitionCtor) return false;
        try {
            stopLiveRec(true);
            const rec = new SpeechRecognitionCtor();
            rec.lang = "en-US";
            rec.continuous = true;
            rec.interimResults = true;
            rec.onresult = (event) => {
                let finals = "";
                let interim = "";
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const text = event.results[i][0].transcript;
                    if (event.results[i].isFinal) finals += `${text} `;
                    else interim += text;
                }
                if (finals.trim()) {
                    wsFinalsRef.current = `${wsFinalsRef.current} ${finals}`.trim();
                    liveTranscriptCommittedRef.current = true;
                    onTranscriptRef.current?.(activeTargetRef.current || target, finals.trim());
                    wsFinalsRef.current = "";
                }
                wsInterimRef.current = interim;
                setInterimText(interim);
            };
            rec.onerror = (event) => {
                if (["not-allowed", "service-not-allowed", "audio-capture"].includes(event?.error)) {
                    setMicPermission("denied");
                }
            };
            rec.onend = () => {
                setInterimText("");
                const expected = liveRecExpectedStopRef.current;
                liveRecExpectedStopRef.current = false;
                if (restartable && !expected && handsFreeRef.current && !handsFreePausedRef.current) {
                    clearLiveRestartTimer();
                    liveRecRestartTimerRef.current = setTimeout(() => {
                        try {
                            rec.start();
                            liveRecRef.current = rec;
                        } catch { void 0; }
                    }, 180);
                }
            };
            liveRecExpectedStopRef.current = false;
            rec.start();
            liveRecRef.current = rec;
            return true;
        } catch {
            return false;
        }
    }, [clearLiveRestartTimer, stopLiveRec]);

    const transcribeBlob = useCallback(async (blob, target, browserCommitted) => {
        if (!enableServerTranscription || !blob || blob.size <= 1000) return "";
        try {
            const form = new FormData();
            form.append("audio", blob, "audio.webm");
            const resp = await api.post(transcribeEndpoint, form, {
                skipAuthRedirect,
                headers: { "Content-Type": "multipart/form-data", ...transcribeHeaders },
            });
            const finalText = (resp?.data?.text || "").trim();
            if (finalText && !browserCommitted) onTranscriptRef.current?.(target, finalText);
            return finalText;
        } catch (error) {
            console.warn("Server transcription failed, using browser transcript when available", error);
            return "";
        }
    }, [enableServerTranscription, skipAuthRedirect, transcribeEndpoint, transcribeHeaders]);

    const startRecorderSegment = useCallback((stream, target, rotate = false) => {
        if (!stream || typeof MediaRecorder === "undefined") return false;
        let recorder;
        try {
            recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
        } catch {
            try { recorder = new MediaRecorder(stream); } catch { return false; }
        }
        clearRotateTimer();
        const chunks = [];
        wsFinalsRef.current = "";
        wsInterimRef.current = "";
        liveTranscriptCommittedRef.current = false;
        recorderStopReasonRef.current = "manual";
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (event) => { if (event.data?.size > 0) chunks.push(event.data); };
        recorder.onstop = async () => {
            const reason = recorderStopReasonRef.current || "manual";
            const browserCommitted = liveTranscriptCommittedRef.current;
            await new Promise((resolve) => setTimeout(resolve, 120));
            const blob = new Blob(chunks, { type: "audio/webm" });
            const finalText = await transcribeBlob(blob, activeTargetRef.current || target, browserCommitted);
            if (!browserCommitted && !finalText) {
                const fallbackText = composeLiveTranscript(wsFinalsRef.current, wsInterimRef.current);
                if (fallbackText) onTranscriptRef.current?.(activeTargetRef.current || target, fallbackText);
            }
            if (reason === "rotate" && handsFreeRef.current && !handsFreePausedRef.current && sessionStreamRef.current) {
                startRecorderSegment(sessionStreamRef.current, activeTargetRef.current || target, true);
                return;
            }
            mediaRecorderRef.current = null;
            setListening(false);
            if (!handsFreeRef.current) {
                setListeningTarget(null);
                try { stream.getTracks().forEach((track) => track.stop()); } catch { void 0; }
                stopMeter();
            }
        };
        recorder.start(250);
        if (rotate) {
            recorderRotateTimerRef.current = setTimeout(() => {
                if (mediaRecorderRef.current === recorder && recorder.state !== "inactive" && handsFreeRef.current && !handsFreePausedRef.current) {
                    recorderStopReasonRef.current = "rotate";
                    try { recorder.stop(); } catch { void 0; }
                }
            }, HANDS_FREE_SEGMENT_MS);
        }
        return true;
    }, [clearRotateTimer, stopMeter, transcribeBlob]);

    const stopRecorder = useCallback((reason = "manual") => {
        clearRotateTimer();
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== "inactive") {
            recorderStopReasonRef.current = reason;
            try { recorder.stop(); } catch { void 0; }
        } else {
            mediaRecorderRef.current = null;
        }
    }, [clearRotateTimer]);

    const fallbackSTT = useCallback(async (target, { handsFree = false } = {}) => {
        try {
            activeTargetRef.current = target;
            wsFinalsRef.current = "";
            wsInterimRef.current = "";
            liveTranscriptCommittedRef.current = false;
            const started = startLiveRecognition(target, handsFree);
            if (!started) throw new Error("Web Speech not available");
            setListening(true);
            setListeningTarget(target);
            if (handsFree) {
                handsFreeRef.current = true;
                handsFreePausedRef.current = false;
                setHandsFreePaused(false);
                setMicSessionActive(true);
            }
        } catch (error) {
            console.debug("Web Speech start error", error);
            setListening(false);
            setListeningTarget(null);
            if (handsFree) setMicSessionActive(false);
        }
    }, [startLiveRecognition]);

    const startListening = useCallback(async (target) => {
        if (!supportsSTT) return;
        if (handsFreeRef.current) {
            activeTargetRef.current = target;
            setListeningTarget(target);
            if (handsFreePausedRef.current) {
                handsFreePausedRef.current = false;
                setHandsFreePaused(false);
                if (sessionStreamRef.current) {
                    startLiveRecognition(target, true);
                    startRecorderSegment(sessionStreamRef.current, target, true);
                    setListening(true);
                } else {
                    await fallbackSTT(target, { handsFree: true });
                }
            }
            return;
        }
        if (!enableServerTranscription && SpeechRecognitionCtor) return fallbackSTT(target);
        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraintsForDevice());
            activeTargetRef.current = target;
            const recorderStarted = startRecorderSegment(stream, target, false);
            if (!recorderStarted && SpeechRecognitionCtor) {
                stream.getTracks().forEach((track) => track.stop());
                return fallbackSTT(target);
            }
            startLiveRecognition(target, false);
            setListening(true);
            setListeningTarget(target);
            setMicPermission("granted");
            startMeter(stream);
        } catch (error) {
            console.debug("getUserMedia failed, falling back to Web Speech", error);
            if (SpeechRecognitionCtor) await fallbackSTT(target);
            else setMicPermission("denied");
        }
    }, [constraintsForDevice, enableServerTranscription, fallbackSTT, startLiveRecognition, startMeter, startRecorderSegment, supportsSTT]);

    const startHandsFree = useCallback(async (target) => {
        if (!supportsSTT || !target) return false;
        activeTargetRef.current = target;
        if (handsFreeRef.current && micSessionActive) {
            setListeningTarget(target);
            if (handsFreePausedRef.current) {
                handsFreePausedRef.current = false;
                setHandsFreePaused(false);
                if (sessionStreamRef.current) {
                    startLiveRecognition(target, true);
                    startRecorderSegment(sessionStreamRef.current, target, true);
                    setListening(true);
                } else {
                    await fallbackSTT(target, { handsFree: true });
                }
            }
            return true;
        }

        handsFreeRef.current = true;
        handsFreePausedRef.current = false;
        setHandsFreePaused(false);
        try {
            if (!enableServerTranscription && SpeechRecognitionCtor) {
                await fallbackSTT(target, { handsFree: true });
                return true;
            }
            const stream = await navigator.mediaDevices.getUserMedia(constraintsForDevice());
            sessionStreamRef.current = stream;
            setMicPermission("granted");
            setMicSessionActive(true);
            setListeningTarget(target);
            startMeter(stream);
            startLiveRecognition(target, true);
            if (!startRecorderSegment(stream, target, true) && !SpeechRecognitionCtor) throw new Error("No supported speech recorder");
            setListening(true);
            return true;
        } catch (error) {
            console.debug("Hands-free microphone start failed", error);
            sessionStreamRef.current = null;
            handsFreeRef.current = false;
            handsFreePausedRef.current = false;
            setMicSessionActive(false);
            setHandsFreePaused(false);
            if (SpeechRecognitionCtor) {
                await fallbackSTT(target, { handsFree: true });
                return true;
            }
            setMicPermission("denied");
            return false;
        }
    }, [constraintsForDevice, enableServerTranscription, fallbackSTT, micSessionActive, startLiveRecognition, startMeter, startRecorderSegment, supportsSTT]);

    const pauseHandsFree = useCallback(async () => {
        if (!handsFreeRef.current) return;
        handsFreePausedRef.current = true;
        setHandsFreePaused(true);
        commitLiveTranscript(activeTargetRef.current);
        stopLiveRec(true);
        stopRecorder("pause");
        setListening(false);
        setInterimText("");
    }, [commitLiveTranscript, stopLiveRec, stopRecorder]);

    const resumeHandsFree = useCallback(async (target = activeTargetRef.current) => {
        if (!handsFreeRef.current || !target || !supportsSTT) return false;
        activeTargetRef.current = target;
        setListeningTarget(target);
        if (!handsFreePausedRef.current && listening) return true;
        handsFreePausedRef.current = false;
        setHandsFreePaused(false);
        if (sessionStreamRef.current) {
            startLiveRecognition(target, true);
            startRecorderSegment(sessionStreamRef.current, target, true);
            setListening(true);
            return true;
        }
        await fallbackSTT(target, { handsFree: true });
        return true;
    }, [fallbackSTT, listening, startLiveRecognition, startRecorderSegment, supportsSTT]);

    const stopHandsFree = useCallback(() => {
        if (!handsFreeRef.current && !sessionStreamRef.current) return;
        handsFreeRef.current = false;
        handsFreePausedRef.current = true;
        setHandsFreePaused(false);
        commitLiveTranscript(activeTargetRef.current);
        stopLiveRec(true);
        stopRecorder("shutdown");
        try { sessionStreamRef.current?.getTracks?.().forEach((track) => track.stop()); } catch { void 0; }
        sessionStreamRef.current = null;
        activeTargetRef.current = null;
        setMicSessionActive(false);
        setListening(false);
        setListeningTarget(null);
        setInterimText("");
        stopMeter();
    }, [commitLiveTranscript, stopLiveRec, stopMeter, stopRecorder]);

    const stopListening = useCallback(() => {
        if (handsFreeRef.current) {
            pauseHandsFree();
            return;
        }
        commitLiveTranscript(listeningTarget || activeTargetRef.current);
        stopLiveRec(true);
        stopRecorder("manual");
        setListening(false);
        setListeningTarget(null);
        stopMeter();
    }, [commitLiveTranscript, listeningTarget, pauseHandsFree, stopLiveRec, stopMeter, stopRecorder]);

    const retargetListening = useCallback((target) => {
        if (!target) return;
        activeTargetRef.current = target;
        if (listening || handsFreeRef.current) setListeningTarget(target);
    }, [listening]);

    const speakNow = useCallback((text) => new Promise((resolve) => {
        try {
            if (!supportsTTS || !text) { resolve(false); return; }
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.95;
            utterance.pitch = 1;
            const voices = window.speechSynthesis.getVoices();
            const preferred =
                voices.find((voice) => voice.name.includes("Google") && voice.lang.startsWith("en")) ||
                voices.find((voice) => voice.lang.startsWith("en"));
            if (preferred) utterance.voice = preferred;
            let settled = false;
            const finish = (value) => {
                if (settled) return;
                settled = true;
                resolve(value);
            };
            utterance.onend = () => finish(true);
            utterance.onerror = () => finish(false);
            window.speechSynthesis.speak(utterance);
        } catch (error) {
            console.warn("speakNow error", error);
            resolve(false);
        }
    }), [supportsTTS]);

    useEffect(() => () => {
        handsFreeRef.current = false;
        handsFreePausedRef.current = true;
        clearRotateTimer();
        clearLiveRestartTimer();
        try { liveRecRef.current?.stop?.(); } catch { void 0; }
        try { mediaRecorderRef.current?.stop?.(); } catch { void 0; }
        try { sessionStreamRef.current?.getTracks?.().forEach((track) => track.stop()); } catch { void 0; }
        try { if (rafRef.current) cancelAnimationFrame(rafRef.current); } catch { void 0; }
        try { audioCtxRef.current?.close?.(); } catch { void 0; }
    }, [clearLiveRestartTimer, clearRotateTimer]);

    return {
        listening, listeningTarget, interimText,
        micLevel, micPermission, micSessionActive, handsFreePaused,
        inputDevices, selectedDeviceId, setSelectedDeviceId,
        supportsSTT, supportsTTS,
        startListening, stopListening, retargetListening, speakNow,
        startHandsFree, pauseHandsFree, resumeHandsFree, stopHandsFree,
    };
};
