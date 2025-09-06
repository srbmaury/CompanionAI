import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import api from "../api/axios";
import { isVoskAvailable, startListeningWithVosk } from "../stt/vosk";

import { Alert, Box, Button, Chip, Divider, Drawer, IconButton, Stack, Typography, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import HelpPopover from "../components/HelpPopover";
import VoiceControls from "../components/VoiceControls";

import ConversationalPanel from "../components/ConversationalPanel";
import FeedbackPanel from "../components/FeedbackPanel";
import OAForm from "../components/OAForm";
import RoundList from "../components/RoundList";

const InterviewPage = () => {
    const { interviewId } = useParams();
    const [interview, setInterview] = useState(null);
    const [selectedRound, setSelectedRound] = useState(null);
    const [loadingRound, setLoadingRound] = useState(false);
    const [roundPrepareProgress, setRoundPrepareProgress] = useState(0);
    const [convState, setConvState] = useState({
        index: 0,
        current: null,
        done: false,
    });
    const [oaAnswers, setOaAnswers] = useState([]);
    const [convAnswer, setConvAnswer] = useState("");
    const [convSavedAt, setConvSavedAt] = useState(null);
    const [oaSubmitting, setOaSubmitting] = useState(false);
    const [roundLocked, setRoundLocked] = useState(false);
    const [oaFeedbackProgress, setOaFeedbackProgress] = useState(0);
    const [convFeedbackProgress, setConvFeedbackProgress] = useState(0);
    const [inlineStatus, setInlineStatus] = useState({ open: false, severity: "info", message: "" });
    const [convSubmitting, setConvSubmitting] = useState(false);
    const [convRoundSubmitting, setConvRoundSubmitting] = useState(false);
    const [roundsOpen, setRoundsOpen] = useState(false);
    const [resumeOpen, setResumeOpen] = useState(false);
    const pendingSavesRef = useRef(new Set());

    // Local persistence helpers
    const storage = useMemo(() => ({
        get(key) {
            try {
                const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
                return raw ? JSON.parse(raw) : null;
            } catch {
                return null;
            }
        },
        set(key, value) {
            try {
                if (typeof window !== "undefined") {
                    window.localStorage.setItem(key, JSON.stringify(value));
                }
            } catch {
                void 0;
            }
        },
        remove(key) {
            try {
                if (typeof window !== "undefined") {
                    window.localStorage.removeItem(key);
                }
            } catch {
                void 0;
            }
        },
    }), []);

    const makeStorageKeys = useMemo(() => ({
        conv: (iid, rid, idx) => `ia:conv:${iid}:${rid}:${idx}`,
        oa: (iid, rid) => `ia:oa:${iid}:${rid}`,
        selRound: (iid) => `ia:selRound:${iid}`,
    }), []);

    // Persist selected round choice
    const selectRound = useCallback((roundOrNull) => {
        setSelectedRound(roundOrNull);
        if (roundOrNull && roundOrNull._id) {
            storage.set(makeStorageKeys.selRound(interviewId), roundOrNull._id);
        }
    }, [interviewId, makeStorageKeys, storage]);

    // Voice controls
    const [listening, setListening] = useState(false);
    const [listeningTarget, setListeningTarget] = useState(null); // 'conv' or question index (number)
    const recognitionRef = useRef(null);
    const voskStopRef = useRef(null);
    const lastResultIndexRef = useRef(0);
    const audioCtxRef = useRef(null);
    const analyserRef = useRef(null);
    const rafRef = useRef(null);
    const [micLevel, setMicLevel] = useState(0);
    const [micPermission, setMicPermission] = useState("unknown");
    const [inputDevices, setInputDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState("default");
    const pushToTalk = false;

    const SpeechRecognitionCtor =
        typeof window !== "undefined"
            ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
            : null;
    const voskModelUrl = (import.meta && import.meta.env && import.meta.env.VITE_VOSK_MODEL_URL)
        ? import.meta.env.VITE_VOSK_MODEL_URL
        : undefined;
    // We will use Whisper via server when available
    const supportsSTT = true;
    const supportsTTS =
        typeof window !== "undefined" && "speechSynthesis" in window;

    const outlinedInputSx = {
        "& .MuiOutlinedInput-root": {
            "& fieldset": { borderColor: "#c4c4c4" },
            "&:hover fieldset": { borderColor: "#1976d2" },
            "&.Mui-focused fieldset": {
                borderColor: "#1976d2",
                borderWidth: 2,
            },
        },
    };

    const showToast = useCallback((severity, message) => {
        setInlineStatus({ open: true, severity, message });
        // auto clear non-error after a short delay to avoid clutter
        if (severity !== "error") setTimeout(() => setInlineStatus((s) => ({ ...s, open: false })), 4000);
    }, []);

    // Helper to clear all saved drafts for a round (placed before callbacks that depend on it)
    const clearDraftsForRound = useCallback((round) => {
        if (!round) return;
        try {
            const oaKey = makeStorageKeys.oa(interviewId, round._id);
            storage.remove(oaKey);
            const limit = Number(round?.questionLimit) || (round?.questions?.length || 20);
            for (let i = 0; i < limit; i++) {
                const ck = makeStorageKeys.conv(interviewId, round._id, i);
                storage.remove(ck);
            }
        } catch {
            void 0;
        }
    }, [interviewId, makeStorageKeys, storage]);

    const handleSkipRound = useCallback(async () => {
                try {
                    await api.delete(
                        `/questions/${interviewId}/rounds/${selectedRound._id}`
                    );
            const { data } = await api.get(`/interviews/${interviewId}`);
                    setInterview(data);
                    // Clear drafts for skipped round
                    clearDraftsForRound(selectedRound);
                    const next = data.rounds[0]?.round || null;
                    selectRound(next);
            showToast("success", "Round skipped.");
                } catch (e) {
                    console.error("skip error", e);
            const msg = e?.response?.data?.message || "Failed to skip round.";
                    showToast("error", msg);
                }
    }, [interviewId, selectedRound, selectRound, showToast, clearDraftsForRound]);

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

    const fallbackSTT = useCallback(async (target) => {
        // Try Vosk if configured
        if (isVoskAvailable() && voskModelUrl) {
            try {
                const session = await startListeningWithVosk({
                    modelUrl: voskModelUrl,
                    onResult: (text) => {
                        if (!text) return;
                        if (target === "conv") {
                            setConvAnswer((prev) => (prev ? prev + " " : "") + text.trim());
                        } else if (typeof target === "number") {
                            setOaAnswers((prev) => {
                                const next = [...prev];
                                const current = next[target] || "";
                                next[target] = (current ? current + " " : "") + text.trim();
                                return next;
                            });
                        }
                    },
                    onError: () => {
                        setListening(false);
                        setListeningTarget(null);
                    },
                });
                voskStopRef.current = session.stop;
                setListening(true);
                setListeningTarget(target);
                return;
            } catch (e) {
                console.warn("Vosk fallback failed", e);
            }
        }
        // Final fallback: Web Speech API
        try {
            const Rec = SpeechRecognitionCtor;
            if (!Rec) throw new Error("Web Speech not available");
            if (recognitionRef.current) {
                recognitionRef.current.stop?.();
                recognitionRef.current = null;
            }
            const rec = new Rec();
            rec.lang = "en-US";
            rec.continuous = true;
            rec.interimResults = true;
            lastResultIndexRef.current = 0;
            rec.onresult = (event) => {
                let appended = "";
                for (let i = lastResultIndexRef.current; i < event.results.length; i++) {
                    const res = event.results[i];
                    if (!res || !res[0]) continue;
                    appended += res[0].transcript;
                }
                if (appended) {
                    if (target === "conv") {
                        setConvAnswer((prev) => (prev ? prev + " " : "") + appended.trim());
                    } else if (typeof target === "number") {
                        setOaAnswers((prev) => {
                            const next = [...prev];
                            const current = next[target] || "";
                            next[target] = (current ? current + " " : "") + appended.trim();
                            return next;
                        });
                    }
                }
                lastResultIndexRef.current = event.results.length;
            };
            rec.onend = () => {
                setListening(false);
                setListeningTarget(null);
            };
            rec.onerror = () => {
                setListening(false);
                setListeningTarget(null);
            };
            rec.start();
            recognitionRef.current = rec;
            setListening(true);
            setListeningTarget(target);
        } catch (err) {
            console.debug("Web Speech start error (ignored)", err);
            setListening(false);
            setListeningTarget(null);
        }
    }, [SpeechRecognitionCtor, voskModelUrl]);

    const startMeter = useCallback((stream) => {
        try {
            // Create analyser to compute simple amplitude level
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
                    // Compute RMS-like level
                    let sum = 0;
                    for (let i = 0; i < data.length; i++) {
                        const v = (data[i] - 128) / 128;
                        sum += v * v;
                    }
                    const rms = Math.sqrt(sum / data.length);
                    setMicLevel(isFinite(rms) ? Math.min(1, Math.max(0, rms * 2)) : 0);
                } catch { /* ignore */ }
                rafRef.current = requestAnimationFrame(tick);
            };
            rafRef.current = requestAnimationFrame(tick);
        } catch { /* ignore audio meter errors */ }
    }, []);

    const stopMeter = useCallback(() => {
        try { if (rafRef.current) cancelAnimationFrame(rafRef.current); } catch { /* ignore */ }
        rafRef.current = null;
        try { analyserRef.current?.disconnect?.(); } catch { /* ignore */ }
        analyserRef.current = null;
        try { audioCtxRef.current?.close?.(); } catch { /* ignore */ }
        audioCtxRef.current = null;
        setMicLevel(0);
    }, []);

    const startListening = useCallback(async (target) => {
        // Prefer Whisper via server using MediaRecorder
        try {
            const constraints = selectedDeviceId && selectedDeviceId !== "default"
                ? { audio: { deviceId: { exact: selectedDeviceId } }, video: false }
                : { audio: true, video: false };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
            const chunks = [];
            mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
            mediaRecorder.onstop = async () => {
                try {
                    const blob = new Blob(chunks, { type: "audio/webm" });
                    const form = new FormData();
                    form.append("audio", blob, "audio.webm");
                    const resp = await api.post("/stt/transcribe", form, {
                        headers: { "Content-Type": "multipart/form-data" },
                    });
                    const text = (resp?.data?.text || "").trim();
                    if (text) {
                        if (target === "conv") {
                            setConvAnswer((prev) => (prev ? prev + " " : "") + text);
                        } else if (typeof target === "number") {
                            setOaAnswers((prev) => {
                                const next = [...prev];
                                const current = next[target] || "";
                                next[target] = (current ? current + " " : "") + text;
                                return next;
                            });
                        }
                    }
                } catch (e) {
                    console.warn("whisper transcribe failed, trying Vosk/Web Speech", e);
                    // Fallback chain: Vosk then Web Speech
                    await fallbackSTT(target);
                } finally {
                    setListening(false);
                    setListeningTarget(null);
                    try { stopMeter(); } catch { /* ignore */ }
                    try { stream.getTracks().forEach((t) => t.stop()); } catch (stopErr) { console.debug("mic stop error", stopErr); }
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
        // Stop Whisper recording if active
        if (recognitionRef.current && typeof recognitionRef.current.stop === "function") {
            try { recognitionRef.current.stop(); } catch (e) { console.debug("whisper stop error", e); }
        }
        // Prefer stopping Vosk if active
        if (voskStopRef.current) {
            try {
                voskStopRef.current();
            } catch (err) {
                console.debug("Vosk stop error (ignored)", err);
            }
            voskStopRef.current = null;
        }
        try {
            recognitionRef.current?.stop?.();
        } catch (e) {
            console.warn("stopListening error", e);
        }
        recognitionRef.current = null;
        setListening(false);
        setListeningTarget(null);
        try { stopMeter(); } catch { /* ignore */ }
    }, [stopMeter]);

    useEffect(() => {
        const fetchInterview = async () => {
            try {
                const { data } = await api.get(`/interviews/${interviewId}`);
                setInterview(data);
                if (data.rounds.length > 0) {
                    const persisted = storage.get(makeStorageKeys.selRound(interviewId));
                    const found = data.rounds.find((r) => r.round?._id === persisted)?.round;
                    selectRound(found || data.rounds[0].round);
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchInterview();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [interviewId]);

    // Mic permissions & device enumeration
    useEffect(() => {
        const updateDevices = async () => {
            try {
                if (!navigator.mediaDevices?.enumerateDevices) return;
                const devs = await navigator.mediaDevices.enumerateDevices();
                const inputs = devs.filter((d) => d.kind === "audioinput").map((d) => ({ deviceId: d.deviceId, label: d.label }));
                setInputDevices(inputs);
            } catch { /* ignore */ }
        };
        const watchDevices = () => {
            try { navigator.mediaDevices?.addEventListener?.("devicechange", updateDevices); } catch { /* ignore */ }
            return () => { try { navigator.mediaDevices?.removeEventListener?.("devicechange", updateDevices); } catch { /* ignore */ } };
        };
        let cleanup = () => {};
        updateDevices();
        try {
            if (navigator.permissions?.query) {
                navigator.permissions.query({ name: "microphone" }).then((status) => {
                    try { setMicPermission(status.state || "unknown"); } catch { /* ignore */ }
                    status.onchange = () => { try { setMicPermission(status.state || "unknown"); } catch { /* ignore */ } };
                }).catch(() => setMicPermission("unknown"));
            }
        } catch { setMicPermission("unknown"); }
        cleanup = watchDevices();
        return () => cleanup();
    }, []);

    const isConversational = useMemo(
        () => selectedRound?.deliveryMode === "conversational",
        [selectedRound]
    );

    const resumeUrl = useMemo(() => interview?.resume?.fileUrl || "", [interview]);
    const resumeFileType = useMemo(() => interview?.resume?.fileType || "", [interview]);
    const resumePreviewUrl = useMemo(() => (
        interview?.resume?._id ? `/api/resumes/${interview.resume._id}/preview` : ""
    ), [interview]);
    const allRoundsCompleted = useMemo(
        () => Array.isArray(interview?.rounds) && interview.rounds.length > 0
            ? interview.rounds.every((r) => r?.round?.status === "completed")
            : false,
        [interview]
    );

    const hasAnsweredMissingFeedback = useMemo(() => {
        const qList = selectedRound?.questions || [];
        for (const q of qList) {
            const answered = (q?.answerGiven || "").toString().trim().length > 0;
            const hasFb = Boolean(q?.feedback);
            if (answered && !hasFb) return true;
        }
        return false;
    }, [selectedRound?.questions]);

    const convViewState = useMemo(() => {
        if (!selectedRound) return convState;
        const completed = selectedRound.status === "completed";
        return { ...convState, done: completed || convState.done };
    }, [convState, selectedRound]);

    // Compute conversational state from selected round (no server polling)
    const syncConvStateFromRound = useCallback((round) => {
        if (!round || round.deliveryMode !== "conversational") return;
        const limit = Math.min(Number(round.questionLimit) || 8, (round.questions?.length || 0));
        const isCompleted = round.status === "completed";
        if (isCompleted) {
            setConvState({ index: 0, current: null, done: true });
            setConvAnswer("");
            return;
        }
        if (limit === 0) {
            // Questions not yet populated; keep not-done state
            setConvState({ index: 0, current: null, done: false });
            setConvAnswer("");
            return;
        }
        let idx = Number(round.conversationalIndex) || 0;
        if (idx >= limit) {
            setConvState({ index: limit, current: null, done: true });
            setConvAnswer("");
            return;
        }
        if (idx > 0) {
            const prev = round.questions?.[idx - 1];
            if (prev && !prev.answerGiven) idx = idx - 1;
        }
        const item = round.questions?.[idx];
        setConvState({ index: idx, current: item?.question || null, done: false });
    }, []);

    // Restore saved draft for conversational answer when question changes
    useEffect(() => {
        if (!selectedRound || !isConversational) return;
        if (!convState || convState.done) return;
        const key = makeStorageKeys.conv(interviewId, selectedRound._id, convState.index);
        const saved = storage.get(key);
        if (typeof saved === "string" && saved !== convAnswer) {
            setConvAnswer(saved);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [interviewId, selectedRound?._id, isConversational, convState.index, convState.current]);

    // Save conversational draft on change (only save non-empty)
    useEffect(() => {
        if (!selectedRound || !isConversational) return;
        if (!convState || convState.done || !convState.current) return;
        const key = makeStorageKeys.conv(interviewId, selectedRound._id, convState.index);
        const trimmed = (convAnswer || "").trim();
        if (trimmed.length === 0) return;
        storage.set(key, convAnswer);
        try { setConvSavedAt(Date.now()); } catch { /* ignore */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [convAnswer]);

    // Restore saved OA drafts when questions are ready
    useEffect(() => {
        if (!selectedRound || isConversational) return;
        const key = makeStorageKeys.oa(interviewId, selectedRound._id);
        const saved = storage.get(key);
        if (Array.isArray(saved) && saved.length > 0) {
            setOaAnswers((prev) => {
                const len = Math.max(prev?.length || 0, selectedRound.questions?.length || 0);
                const next = new Array(len).fill("");
                for (let i = 0; i < len; i++) {
                    next[i] = (saved[i] ?? prev?.[i] ?? "").toString();
                }
                return next;
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [interviewId, selectedRound?._id, selectedRound?.questions?.length, isConversational]);

    // Save OA drafts on change (only save when any non-empty exists)
    useEffect(() => {
        if (!selectedRound || isConversational) return;
        const key = makeStorageKeys.oa(interviewId, selectedRound._id);
        const hasContent = (oaAnswers || []).some((a) => (a || "").toString().trim().length > 0);
        if (!hasContent) return;
        storage.set(key, oaAnswers || []);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [oaAnswers]);

    // Prepare questions when a round is selected and has no questions yet
    useEffect(() => {
        const prepareIfNeeded = async () => {
            if (!selectedRound) return;
            // Do not prepare for completed rounds; ensure loading indicator is off
            if (selectedRound.status === "completed") {
                setLoadingRound(false);
                return;
            }
            if (selectedRound.questions && selectedRound.questions.length > 0)
                return;
            try {
                // Gate: prevent preparing if previous round is not completed
                const order = interview?.rounds || [];
                const idx = order.findIndex(
                    (r) => r.round._id === selectedRound._id
                );
                const prevIncomplete = order
                    .slice(0, idx)
                    .some((r) => r.round.status !== "completed");
                setRoundLocked(prevIncomplete);
                // If we believe this round was prefetched, try a silent refresh before showing loading
                // removed prefetched shortcut and scheduling logic

                if (!prevIncomplete) {
                    const desiredCount = Number(selectedRound?.questionLimit) || (isConversational ? 8 : 12);
                    setLoadingRound(true);
                    setRoundPrepareProgress(0);
                    // Enqueue background job
                    const { data: job } = await api.post(`/jobs/prepare-questions`, {
                        interviewId,
                        roundId: selectedRound._id,
                        count: desiredCount,
                        prefetch: false,
                    });
                    const jobId = job?.jobId;
                    if (jobId) {
                        const start = Date.now();
                        const poll = async () => {
                            try {
                                const { data: status } = await api.get(`/jobs/status/prepare-questions/${jobId}`);
                                const prog = Number(status?.progress) || 0;
                                setRoundPrepareProgress(Math.max(0, Math.min(100, prog)));
                                const state = status?.state;
                                if (state === "completed" || state === "failed") return state;
                                if (Date.now() - start > 60000) return "timeout";
                                await new Promise((r) => setTimeout(r, 700));
                                return await poll();
                            } catch {
                                // backoff on transient errors
                                await new Promise((r) => setTimeout(r, 1000));
                                return await poll();
                            }
                        };
                        await poll();
                    }
                }
                const { data } = await api.get(`/interviews/${interviewId}`);
                setInterview(data);
                const updated = data.rounds.find(
                    (r) => r.round._id === selectedRound._id
                )?.round;
                if (updated) selectRound(updated);
                if (updated && updated.deliveryMode === "online-assessment") {
                    setOaAnswers(
                        new Array(updated.questions?.length || 0).fill("")
                    );
                } else if (updated && updated.deliveryMode === "conversational") {
                    syncConvStateFromRound(updated);
                } else if (!updated) {
                    setOaAnswers([]);
                }
                // removed next round scheduling
            } catch (e) {
                console.error("prepare round failed", e);
            } finally {
                setLoadingRound(false);
                setRoundPrepareProgress(0);
            }
            prepareNextRound(selectedRound);
        };
        prepareIfNeeded();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedRound?._id]);

    const prepareNextRound = useCallback((round) => {
        if (!round) return;
        const nextRoundId = round.nextRound;
        if (!nextRoundId) return;
        try {
            const nextEntry = (interview?.rounds || []).find((r) => String(r?.round?._id) === String(nextRoundId));
            const nextRound = nextEntry?.round;
            if (!nextRound) return;
            const hasQuestions = Array.isArray(nextRound.questions) && nextRound.questions.length > 0;
            if (hasQuestions) return;
            const desiredCount = Math.min(Math.max(Number(nextRound?.questionLimit) || (nextRound?.deliveryMode === "online-assessment" ? 12 : 8), 1), 20);
            // fire-and-forget prefetch; do not block UI
            api.post(`/questions/${interviewId}/rounds/${nextRoundId}/prepare`, { count: desiredCount, prefetch: true })
                .catch((e) => console.warn("prefetch next round failed", e));
        } catch (e) {
            console.warn("prepareNextRound error", e);
        }
    }, [interview?.rounds, interviewId]);

    // For conversational rounds, compute current question when selection or status changes
    useEffect(() => {
        if (!selectedRound || !isConversational) return;
        syncConvStateFromRound(selectedRound);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedRound?._id, isConversational, selectedRound?.conversationalIndex, selectedRound?.status]);

    // Immediate prefetch removed to adhere to 30s scheduling policy
    const handleSubmitAnswer = useCallback(async (answer) => {
        if (!selectedRound || !isConversational) return;
        // Optimistic local advance: update UI immediately, submit in background
        const currentIndex = convState.index;
        setConvSubmitting(true);
        const limitForSelected = Math.min(Number(selectedRound?.questionLimit) || 8, (selectedRound?.questions?.length || 0));
        const isLast = currentIndex + 1 >= limitForSelected && limitForSelected > 0;
        setSelectedRound((prev) => {
            if (!prev) return prev;
            const copy = { ...prev, questions: [...(prev.questions || [])] };
            if (copy.questions[currentIndex]) {
                copy.questions[currentIndex] = {
                    ...copy.questions[currentIndex],
                    answerGiven: answer,
                };
            }
            const limit = Math.min(Number(copy.questionLimit) || 8, (copy.questions?.length || 0));
            const nextIndex = currentIndex + 1;
            copy.conversationalIndex = nextIndex;
            if (nextIndex >= limit) copy.status = "completed";
            setInterview((prevInt) => {
                if (!prevInt) return prevInt;
                const rounds = (prevInt.rounds || []).map((r) => {
                    if (r.round._id === copy._id) return { ...r, round: copy };
                    return r;
                });
                return { ...prevInt, rounds };
            });
            setTimeout(() => syncConvStateFromRound(copy), 0);
            return copy;
        });
        setConvAnswer("");
        try { storage.remove(makeStorageKeys.conv(interviewId, selectedRound._id, currentIndex)); } catch { void 0; }
        if (isLast) {
            try {
                // Submit and capture feedback job id for polling
                setConvRoundSubmitting(true);
                setConvFeedbackProgress(0);
                const resp = await api.post(`/questions/${selectedRound._id}/answer`, { index: currentIndex, answer });
                const jobId = resp?.data?.feedbackJobId;
                if (jobId) {
                    const start = Date.now();
                    const poll = async () => {
                        try {
                            const { data: status } = await api.get(`/jobs/status/bulk-feedback/${jobId}`);
                            const prog = Number(status?.progress) || 0;
                            setConvFeedbackProgress(Math.max(0, Math.min(100, prog)));
                            const state = status?.state;
                            if (state === "completed" || state === "failed") return state;
                            if (Date.now() - start > 60000) return "timeout";
                            await new Promise((r) => setTimeout(r, 700));
                            return await poll();
                        } catch {
                            await new Promise((r) => setTimeout(r, 1000));
                            return await poll();
                        }
                    };
                    await poll();
                }
                // Refresh interview to reflect attached feedback and completed status
                const { data } = await api.get(`/interviews/${interviewId}`);
                setInterview(data);
                const updated = data.rounds.find((r) => r.round._id === selectedRound._id)?.round;
                if (updated) {
                    selectRound(updated);
                }
            } catch (e) {
                console.error("final answer submit error", e);
                showToast("warning", "Failed to save final answer or load feedback.");
            } finally {
                setConvRoundSubmitting(false);
                setConvSubmitting(false);
                setConvFeedbackProgress(0);
            }
        } else {
            // Background submit; do not block UI for non-final answers
            const savePromise = api.post(`/questions/${selectedRound._id}/answer`, {
                index: currentIndex,
                answer,
            }).catch((e) => {
                console.error("submit answer error", e);
                showToast("warning", "Failed to save answer. Retrying may help.");
            }).finally(() => {
                try { pendingSavesRef.current.delete(savePromise); } catch { /* ignore cleanup error */ }
                setConvSubmitting(false);
            });
            try { pendingSavesRef.current.add(savePromise); } catch { /* ignore track error */ }
        }
    }, [selectedRound, isConversational, convState.index, storage, makeStorageKeys, interviewId, showToast, syncConvStateFromRound, selectRound]);

    const handleClarify = useCallback(async (message) => {
        if (!selectedRound || !isConversational) return;
        try {
            const { data } = await api.post(`/questions/${selectedRound._id}/clarify`, { message });
            const ans = (data?.answer || "").toString();
            if (ans) {
                showToast("info", ans, true);
            }
        } catch (e) {
            console.error("clarify error", e);
            const msg = e?.response?.data?.message || "Failed to clarify.";
            showToast("error", msg);
        }
    }, [selectedRound, isConversational, showToast]);

    const handleOAChange = useCallback((i, val) => {
        setOaAnswers((prev) => {
            const next = [...prev];
            next[i] = val;
            return next;
        });
    }, []);

    const handleOASubmit = useCallback(async () => {
        if (!selectedRound || isConversational) return;
        // Client-side guards
        if (roundLocked) {
            showToast("warning", "Complete the previous round first.");
            return;
        }
        const hasQuestions =
            Array.isArray(selectedRound.questions) &&
            selectedRound.questions.length > 0;
        if (!hasQuestions) {
            showToast("warning", "No questions yet. Please wait or reselect the round.");
            return;
        }
        const anyAnswer = (oaAnswers || []).some(
            (a) => (a || "").toString().trim().length > 0
        );
        if (!anyAnswer) {
            showToast("warning", "Please provide at least one answer before submitting.");
            return;
        }
        try {
            setOaSubmitting(true);
            setOaFeedbackProgress(0);
            const limit = selectedRound.questions?.length || 0;
            const outgoing = Array.from({ length: limit }, (_, i) => (oaAnswers?.[i] ?? "").toString());
            await api.post(`/questions/${selectedRound._id}/answers`, { answers: outgoing });
            // Enqueue feedback generation and attach in background, show progress
            try {
                const answered = (selectedRound.questions || [])
                    .map((q, i) => ({
                        index: i,
                        questionId: q.question?._id,
                        answer: (outgoing[i] || "").toString().trim(),
                    }))
                    .filter((it) => it.questionId && it.answer.length > 0);
                if (answered.length > 0) {
                    const { data: job } = await api.post(`/jobs/bulk-feedback`, { roundId: selectedRound._id, items: answered, attach: true });
                    const jobId = job?.jobId;
                    if (jobId) {
                        const start = Date.now();
                        const poll = async () => {
                            try {
                                const { data: status } = await api.get(`/jobs/status/bulk-feedback/${jobId}`);
                                const prog = Number(status?.progress) || 0;
                                setOaFeedbackProgress(Math.max(0, Math.min(100, prog)));
                                const state = status?.state;
                                if (state === "completed" || state === "failed") return state;
                                if (Date.now() - start > 60000) return "timeout";
                                await new Promise((r) => setTimeout(r, 700));
                                return await poll();
                            } catch {
                                await new Promise((r) => setTimeout(r, 1000));
                                return await poll();
                            }
                        };
                        await poll();
                    }
                }
            } catch (e) {
                console.error("bulk feedback enqueue error", e);
            }
            await api.post(`/questions/${selectedRound._id}/complete`);
            const { data } = await api.get(`/interviews/${interviewId}`);
            setInterview(data);
            const updated = data.rounds.find(
                (r) => r.round._id === selectedRound._id
            )?.round;
            if (updated) selectRound(updated);
            // Clear saved OA drafts after successful submit
            try { storage.remove(makeStorageKeys.oa(interviewId, selectedRound._id)); } catch { void 0; }
            clearDraftsForRound(selectedRound);
            showToast("success", "Round submitted successfully.");
        } catch (e) {
            console.error("OA submit error", e);
            const msg = e?.response?.data?.message || "Failed to submit round.";
            showToast("error", msg);
        } finally {
            setOaSubmitting(false);
            setOaFeedbackProgress(0);
        }
    }, [selectedRound, isConversational, roundLocked, oaAnswers, interviewId, selectRound, storage, makeStorageKeys, clearDraftsForRound, showToast]);

    const handleCompleteRound = useCallback(async () => {
        if (!selectedRound) return;
        try {
            setConvRoundSubmitting(true);
            // Wait briefly for any in-flight answer saves
            try {
                const pending = Array.from(pendingSavesRef.current || []);
                if (pending.length > 0) {
                    await Promise.race([
                        Promise.allSettled(pending),
                        new Promise((res) => setTimeout(res, 1500)),
                    ]);
                }
            } catch { /* ignore wait errors */ }
            // Refresh latest interview state before generating feedback
            let latest;
            try {
                const ref = await api.get(`/interviews/${interviewId}`);
                latest = ref.data;
                setInterview(latest);
            } catch { /* ignore refresh failure */ }
            const getRoundFrom = (data) => data?.rounds?.find((r) => r.round?._id === selectedRound._id)?.round;
            const roundForFeedback = getRoundFrom(latest || { rounds: [] }) || selectedRound;
            // Generate all feedback via background job for conversational round (only for answered questions)
            try {
                setConvFeedbackProgress(0);
                const answered = (roundForFeedback.questions || [])
                    .map((q, i) => ({
                        index: i,
                        questionId: q.question?._id,
                        answer: (q.answerGiven || "").toString().trim(),
                    }))
                    .filter((it) => it.questionId && it.answer.length > 0);
                if (answered.length > 0) {
                    const { data: job } = await api.post(`/jobs/bulk-feedback`, { roundId: selectedRound._id, items: answered, attach: true });
                    const jobId = job?.jobId;
                    if (jobId) {
                        const start = Date.now();
                        const poll = async () => {
                            try {
                                const { data: status } = await api.get(`/jobs/status/bulk-feedback/${jobId}`);
                                const prog = Number(status?.progress) || 0;
                                setConvFeedbackProgress(Math.max(0, Math.min(100, prog)));
                                const state = status?.state;
                                if (state === "completed" || state === "failed") return state;
                                if (Date.now() - start > 60000) return "timeout";
                                await new Promise((r) => setTimeout(r, 700));
                                return await poll();
                            } catch {
                                await new Promise((r) => setTimeout(r, 1000));
                                return await poll();
                            }
                        };
                        await poll();
                    }
                }
            } catch (e) {
                console.error("bulk feedback (conversational) enqueue error", e);
            }
            // Mark round complete on server
            await api.post(`/questions/${selectedRound._id}/complete`);
            const { data } = await api.get(`/interviews/${interviewId}`);
            setInterview(data);
            clearDraftsForRound(selectedRound);
            // removed scheduling for round after next
            // Move to the next round immediately if available, otherwise refresh the current one to reflect completion
            const idxNow = (data.rounds || []).findIndex((r) => r.round._id === selectedRound._id);
            const nextRound = idxNow >= 0 && idxNow + 1 < (data.rounds || []).length ? data.rounds[idxNow + 1].round : null;
            if (nextRound) {
                selectRound(nextRound);
            } else {
                const updatedSelf = (data.rounds || []).find((r) => r.round._id === selectedRound._id)?.round;
                if (updatedSelf) selectRound(updatedSelf);
            }
            showToast("success", "Round submitted. Preparing feedback in background.");
        } catch (e) {
            console.error("complete round error", e);
            const msg =
                e?.response?.data?.message || "Failed to complete round.";
            showToast("error", msg);
        } finally {
            setConvRoundSubmitting(false);
            setConvFeedbackProgress(0);
        }
    }, [selectedRound, interviewId, clearDraftsForRound, selectRound, showToast]);

    if (!interview) return <Typography>Loading...</Typography>;

    return (
        <>
            <Box sx={{ display: "flex", gap: 3, p: { xs: 2, md: 3 }, flexDirection: { xs: "column", md: "row" } }}>
                {/* Left: Rounds List */}
                <Box sx={{ width: { xs: "100%", md: 250 }, flexShrink: 0 }}>
                    {/* Mobile toggle */}
                    <Box sx={{ display: { xs: "flex", md: "none" }, mb: 1, justifyContent: "space-between", alignItems: "center" }}>
                        <Typography variant="h6">Rounds</Typography>
                        <IconButton onClick={() => setRoundsOpen(true)} aria-label="open rounds">
                            <MenuIcon />
                        </IconButton>
                    </Box>
                    <RoundList
                        interview={interview}
                        selectedRoundId={selectedRound?._id}
                        onSelect={selectRound}
                    />
                    {/* Mobile Drawer */}
                    <Drawer anchor="left" open={roundsOpen} onClose={() => setRoundsOpen(false)} sx={{ display: { md: "none" } }}>
                        <Box sx={{ width: 300, p: 2 }} role="presentation">
                            <Typography variant="h6" sx={{ mb: 1 }}>Rounds</Typography>
                            <Divider sx={{ mb: 2 }} />
                            <RoundList
                                interview={interview}
                                selectedRoundId={selectedRound?._id}
                                onSelect={(r) => { selectRound(r); setRoundsOpen(false); }}
                                showOnMobile
                            />
                        </Box>
                    </Drawer>
                </Box>

                {/* Right: Selected Round Details */}
                <Box sx={{ flexGrow: 1 }}>
                    {inlineStatus.open && (
                        <Alert
                            severity={inlineStatus.severity}
                            aria-live={inlineStatus.severity === "error" ? undefined : "polite"}
                            role={inlineStatus.severity === "error" ? "alert" : undefined}
                            sx={{ mb: 2 }}
                            onClose={() => setInlineStatus((s) => ({ ...s, open: false }))}
                        >
                            {inlineStatus.message}
                        </Alert>
                    )}
                    {!selectedRound ? (
                        <Typography>Select a round to view details</Typography>
                    ) : (
                        <>
                            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={1} sx={{ mb: { xs: 2, md: 2 } }}>
                                <Stack>
                                    <Typography variant="h5" gutterBottom>
                                        {selectedRound.name}
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {selectedRound.description}
                                    </Typography>
                                </Stack>
                                <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "center" }} sx={{ mb: { xs: 2, md: 0 } }}>
                                    {allRoundsCompleted && Number.isFinite(Number(interview?.overallScore)) && (
                                        <Chip color="primary" label={`Overall Score: ${interview.overallScore}/10`} />
                                    )}
                                    {resumeUrl && (
                                        <Button
                                            variant="outlined"
                                            onClick={() => {
                                                if (resumeFileType === "application/pdf") setResumeOpen(true);
                                                else window.open(resumeUrl, "_blank");
                                            }}
                                            sx={{ mb: { xs: 2, md: 0 } }}
                                        >
                                            View Resume
                                        </Button>
                                    )}
                                </Stack>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <HelpPopover />
                                </Stack>
                            </Stack>

                            {loadingRound ? (
                                <Typography>
                                    Preparing questions{roundPrepareProgress ? `… ${Math.min(100, Math.max(0, Math.round(roundPrepareProgress)))}%` : "..."}
                                </Typography>
                            ) : isConversational ? (
                                selectedRound.status === "completed" ? (
                                    (convRoundSubmitting || hasAnsweredMissingFeedback) ? (
                                        <Typography>
                                            Generating feedback… {convFeedbackProgress ? `${Math.round(convFeedbackProgress)}%` : ""}
                                        </Typography>
                                    ) : (
                                        <FeedbackPanel round={selectedRound} />
                                    )
                                ) : (
                                    <>
                                        <ConversationalPanel
                                            convSubmitting={convSubmitting}
                                            convRoundSubmitting={convRoundSubmitting}
                                            convState={convViewState}
                                            convAnswer={convAnswer}
                                            setConvAnswer={setConvAnswer}
                                            onSubmitAnswer={handleSubmitAnswer}
                                            onClarify={handleClarify}
                                            onCompleteRound={handleCompleteRound}
                                            onSkip={handleSkipRound}
                                            supportsTTS={supportsTTS}
                                            supportsSTT={supportsSTT}
                                            listening={listening}
                                            listeningTarget={listeningTarget}
                                            onSpeak={speakNow}
                                            onStartListening={startListening}
                                            onStopListening={stopListening}
                                            savedAt={convSavedAt}
                                            micPermission={micPermission}
                                            micLevel={micLevel}
                                            inputDevices={inputDevices}
                                            selectedDeviceId={selectedDeviceId}
                                            onChangeDevice={setSelectedDeviceId}
                                            pushToTalk={pushToTalk}
                                            outlinedInputSx={outlinedInputSx}
                                        />
                                        {convRoundSubmitting && (
                                            <Typography sx={{ mt: 1 }}>
                                                Generating feedback… {convFeedbackProgress ? `${Math.round(convFeedbackProgress)}%` : ""}
                                            </Typography>
                                        )}
                                    </>
                                )
                            ) : (
                                <>
                                    {selectedRound.status === "completed" ? (
                                        hasAnsweredMissingFeedback ? (
                                            <Typography>
                                                Generating feedback… {oaFeedbackProgress ? `${Math.round(oaFeedbackProgress)}%` : ""}
                                            </Typography>
                                        ) : (
                                            <FeedbackPanel round={selectedRound} />
                                        )
                                    ) : (
                                        <>
                                            <OAForm
                                                questions={selectedRound.questions}
                                                answers={oaAnswers}
                                                onChange={handleOAChange}
                                                onSubmit={handleOASubmit}
                                                onSkip={handleSkipRound}
                                                submitting={oaSubmitting}
                                                supportsTTS={supportsTTS}
                                                supportsSTT={supportsSTT}
                                                listening={listening}
                                                listeningTarget={listeningTarget}
                                                onSpeak={speakNow}
                                                onStartListening={startListening}
                                                onStopListening={stopListening}
                                                micPermission={micPermission}
                                                micLevel={micLevel}
                                                inputDevices={inputDevices}
                                                selectedDeviceId={selectedDeviceId}
                                                onChangeDevice={setSelectedDeviceId}
                                                pushToTalk={pushToTalk}
                                                outlinedInputSx={outlinedInputSx}
                                            />
                                            {oaSubmitting && (
                                                <Typography sx={{ mt: 1 }}>
                                                    Generating feedback… {oaFeedbackProgress ? `${Math.round(oaFeedbackProgress)}%` : ""}
                                                </Typography>
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </Box>
            </Box>

            {selectedRound && isConversational && !convViewState?.done && (
                <Box
                    sx={{
                        position: { xs: "fixed", md: "static" },
                        bottom: 0,
                        left: 0,
                        right: 0,
                        bgcolor: (theme) => theme.palette.background.paper,
                        borderTop: { xs: "1px solid rgba(0,0,0,0.12)", md: "none" },
                        p: { xs: 1, md: 0 },
                        display: { xs: "block", md: "none" },
                        zIndex: 1200,
                    }}
                >
                    <Stack direction="row" spacing={1} alignItems="center">
                        <VoiceControls
                            target="conv"
                            speakText={convViewState?.current?.text}
                            supportsTTS={supportsTTS}
                            supportsSTT={supportsSTT}
                            listening={listening}
                            listeningTarget={listeningTarget}
                            onSpeak={speakNow}
                            onStartListening={startListening}
                            onStopListening={stopListening}
                            micPermission={micPermission}
                            micLevel={micLevel}
                            inputDevices={inputDevices}
                            selectedDeviceId={selectedDeviceId}
                            onChangeDevice={setSelectedDeviceId}
                            pushToTalk={pushToTalk}
                        />
                        <Button
                            variant="contained"
                            size="large"
                            fullWidth
                            disabled={convSubmitting}
                            onClick={() => handleSubmitAnswer(convAnswer)}
                        >
                            {convSubmitting ? "Submitting…" : "Submit"}
                        </Button>
                    </Stack>
                </Box>
            )}

            <Dialog
                open={resumeOpen}
                onClose={() => setResumeOpen(false)}
                fullWidth
                maxWidth="xl"
                PaperProps={{ sx: { height: "92vh" } }}
                aria-labelledby="resume-dialog-title"
            >
                <DialogTitle id="resume-dialog-title">Resume</DialogTitle>
                <DialogContent dividers sx={{ p: 0, height: "100%" }}>
                    {resumePreviewUrl && resumeFileType === "application/pdf" ? (
                        <iframe
                            src={resumePreviewUrl}
                            title="Resume Preview"
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                        />
                    ) : (
                        <Box sx={{ p: 2 }}>
                            <Typography>Preview available for PDFs only.</Typography>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    {resumeUrl && (
                        <Button onClick={() => window.open(resumeUrl, "_blank")}>
                            Download
                        </Button>
                    )}
                    <Button onClick={() => setResumeOpen(false)} autoFocus>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

            {null}
        </>
    );
};

export default InterviewPage;
