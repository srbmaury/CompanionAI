import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
    Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress,
    Container, Divider, FormControlLabel, LinearProgress, Paper, Stack, TextField,
    Typography,
} from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import MicRoundedIcon from "@mui/icons-material/MicRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import api from "../api/axios";
import CodeEditorField from "../components/CodeEditorField";
import SystemDesignDiscussionPanel from "../components/SystemDesignDiscussionPanel";
import WebcamPreview from "../components/WebcamPreview";
import { useVoiceInput } from "../hooks/useVoiceInput";

const savedKey = (token) => `assessment-attempt:${token}`;
const readSaved = (key) => { try { return JSON.parse(window.localStorage?.getItem(key) || "null"); } catch { return null; } };
const writeSaved = (key, value) => { try { window.localStorage?.setItem(key, JSON.stringify(value)); } catch { void 0; } };
const clearSaved = (key) => { try { window.localStorage?.removeItem(key); } catch { void 0; } };
const pendingFollowUp = (question) => Boolean(question?.followUpQuestion && !question?.followUpAnswer);

export default function CandidateAssessmentExperiencePage() {
    const { shareToken } = useParams();
    const invitationId = useMemo(() => new URLSearchParams(window.location.search).get("invite") || "", []);
    const storageKey = savedKey(shareToken);
    const [assessment, setAssessment] = useState(null);
    const [attempt, setAttempt] = useState(null);
    const [attemptToken, setAttemptToken] = useState("");
    const [identity, setIdentity] = useState({ name: "", email: "" });
    const [privacyConsent, setPrivacyConsent] = useState(false);
    const [integrityConsent, setIntegrityConsent] = useState(false);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [roundIndex, setRoundIndex] = useState(0);
    const [questionIndex, setQuestionIndex] = useState(0);
    const [draft, setDraft] = useState("");
    const [diagram, setDiagram] = useState("");
    const [lastSavedAt, setLastSavedAt] = useState(null);
    const [online, setOnline] = useState(navigator.onLine);
    const [cameraReady, setCameraReady] = useState(false);
    const [micReady, setMicReady] = useState(false);
    const spokenQuestionRef = useRef("");

    const round = attempt?.rounds?.[roundIndex];
    const question = round?.questions?.[questionIndex];
    const mode = round?.deliveryMode || "conversational";
    const followUp = pendingFollowUp(question);
    const activePrompt = followUp ? question?.followUpQuestion : question?.text;
    const voiceTarget = `candidate:${roundIndex}:${questionIndex}:${followUp ? "followup" : "answer"}`;

    const candidateHeaders = useMemo(() => attemptToken ? { "X-Attempt-Token": attemptToken } : {}, [attemptToken]);
    const toolBase = attempt?._id ? `/assessments/public/${shareToken}/attempts/${attempt._id}` : "";

    const onTranscript = useCallback((_target, text) => {
        if (!text || window.speechSynthesis?.speaking) return;
        setDraft((current) => `${current}${current ? " " : ""}${text}`.trimStart());
    }, []);

    const {
        listening, listeningTarget, interimText, micLevel, micPermission,
        supportsSTT, supportsTTS, micSessionActive, handsFreePaused,
        startHandsFree, pauseHandsFree, resumeHandsFree, stopHandsFree, speakNow,
    } = useVoiceInput({
        onTranscript,
        transcribeEndpoint: toolBase ? `${toolBase}/transcribe` : "/stt/transcribe",
        transcribeHeaders: candidateHeaders,
        enableServerTranscription: assessment?.capabilities?.transcription !== false,
        skipAuthRedirect: true,
    });

    const persist = useCallback((nextAttempt = attempt, token = attemptToken, navigation = { roundIndex, questionIndex }) => {
        if (!nextAttempt || !token) return;
        const savedAt = new Date().toISOString();
        setLastSavedAt(savedAt);
        writeSaved(storageKey, { attempt: nextAttempt, attemptToken: token, navigation, savedAt });
    }, [attempt, attemptToken, questionIndex, roundIndex, storageKey]);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const { data } = await api.get(`/assessments/public/${shareToken}`, {
                    params: invitationId ? { invite: invitationId } : undefined,
                    skipAuthRedirect: true,
                });
                if (!mounted) return;
                setAssessment(data);
                const saved = readSaved(storageKey);
                if (saved?.attempt && saved?.attemptToken && saved.attempt.status === "started") {
                    setAttempt(saved.attempt);
                    setAttemptToken(saved.attemptToken);
                    setRoundIndex(Math.max(0, Number(saved.navigation?.roundIndex) || 0));
                    setQuestionIndex(Math.max(0, Number(saved.navigation?.questionIndex) || 0));
                    setLastSavedAt(saved.savedAt || null);
                }
            } catch (requestError) {
                if (mounted) setError(requestError?.response?.data?.message || "This assessment link is invalid, closed, or expired.");
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [invitationId, shareToken, storageKey]);

    useEffect(() => {
        const update = () => setOnline(navigator.onLine);
        window.addEventListener("online", update);
        window.addEventListener("offline", update);
        return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
    }, []);

    useEffect(() => {
        if (!attempt || !attemptToken) return;
        persist(attempt, attemptToken);
    }, [attempt, attemptToken, persist, questionIndex, roundIndex]);

    useEffect(() => {
        if (!question) { setDraft(""); setDiagram(""); return; }
        setDraft(followUp ? (question.followUpAnswer || "") : (question.answer || question.spokenExplanation || ""));
        setDiagram(question.diagramData || "");
    }, [followUp, question?._id, question?.followUpQuestion]);

    useEffect(() => {
        if (!attempt || !assessment?.integrity?.enabled) return undefined;
        const record = (type) => {
            if (!attempt?._id || !attemptToken) return;
            api.post(`${toolBase}/integrity-events`, { type, metadata: {} }, { headers: candidateHeaders, skipAuthRedirect: true }).catch(() => {});
        };
        const visibility = () => { if (document.hidden && assessment.integrity.trackFocus) record("tab_hidden"); };
        const blur = () => { if (assessment.integrity.trackFocus) record("window_blur"); };
        const fullscreen = () => { if (assessment.integrity.requireFullscreen && !document.fullscreenElement) record("fullscreen_exit"); };
        const copy = () => { if (assessment.integrity.trackClipboard) record("copy"); };
        const paste = () => { if (assessment.integrity.trackClipboard) record("paste"); };
        document.addEventListener("visibilitychange", visibility);
        document.addEventListener("fullscreenchange", fullscreen);
        document.addEventListener("copy", copy);
        document.addEventListener("paste", paste);
        window.addEventListener("blur", blur);
        return () => {
            document.removeEventListener("visibilitychange", visibility);
            document.removeEventListener("fullscreenchange", fullscreen);
            document.removeEventListener("copy", copy);
            document.removeEventListener("paste", paste);
            window.removeEventListener("blur", blur);
        };
    }, [assessment?.integrity, attempt, attemptToken, candidateHeaders, toolBase]);

    const requestCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach((track) => track.stop());
            setCameraReady(true);
            setError("");
        } catch {
            setCameraReady(false);
            setError("Camera access is required for this assessment. Allow camera permission and try again.");
        }
    };

    const requestMicrophone = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((track) => track.stop());
            setMicReady(true);
            setError("");
        } catch {
            setMicReady(false);
            setError("Microphone access is blocked. Voice rounds can still fall back to typing, but the intended interview experience uses audio.");
        }
    };

    const startAssessment = async (event) => {
        event.preventDefault();
        setBusy(true); setError("");
        try {
            if (assessment?.integrity?.requireFullscreen && !document.fullscreenElement) {
                try { await document.documentElement.requestFullscreen?.(); } catch { /* server-side integrity logging still applies */ }
            }
            const { data } = await api.post(`/assessments/public/${shareToken}/start`, {
                ...identity,
                privacyConsent: true,
                integrityConsent: assessment?.integrity?.enabled ? integrityConsent : false,
                ...(invitationId ? { invitationId } : {}),
            }, { skipAuthRedirect: true });
            setAttempt(data.attempt);
            setAttemptToken(data.attemptToken);
            setRoundIndex(0); setQuestionIndex(0);
            persist(data.attempt, data.attemptToken, { roundIndex: 0, questionIndex: 0 });
        } catch (requestError) {
            setError(requestError?.response?.data?.message || "We couldn’t start your assessment.");
        } finally { setBusy(false); }
    };

    const speakPrompt = useCallback(async (text) => {
        if (!text) return;
        await pauseHandsFree();
        if (supportsTTS) await speakNow(text);
        await resumeHandsFree(voiceTarget);
    }, [pauseHandsFree, resumeHandsFree, speakNow, supportsTTS, voiceTarget]);

    useEffect(() => {
        if (!attempt || mode !== "conversational" || !activePrompt || !supportsSTT) return;
        let cancelled = false;
        (async () => {
            await startHandsFree(voiceTarget);
            if (cancelled) return;
            if (spokenQuestionRef.current !== activePrompt) {
                spokenQuestionRef.current = activePrompt;
                await speakPrompt(activePrompt);
            } else if (handsFreePaused) {
                await resumeHandsFree(voiceTarget);
            }
        })();
        return () => { cancelled = true; };
    }, [activePrompt, attempt, handsFreePaused, mode, resumeHandsFree, speakPrompt, startHandsFree, supportsSTT, voiceTarget]);

    useEffect(() => {
        if (mode !== "conversational") stopHandsFree();
    }, [mode, stopHandsFree]);

    const navigateAfterSave = useCallback((nextAttempt, currentRoundIndex = roundIndex, currentQuestionIndex = questionIndex) => {
        const nextRound = nextAttempt?.rounds?.[currentRoundIndex];
        const current = nextRound?.questions?.[currentQuestionIndex];
        if (pendingFollowUp(current)) {
            setAttempt(nextAttempt);
            return;
        }
        if (nextRound?.questions?.length > currentQuestionIndex + 1) {
            setAttempt(nextAttempt);
            setQuestionIndex(currentQuestionIndex + 1);
            return;
        }
        const roundFinished = nextRound?.adaptiveComplete || nextRound?.deliveryMode !== "conversational";
        if (roundFinished && nextAttempt?.rounds?.[currentRoundIndex + 1]) {
            setAttempt(nextAttempt);
            setRoundIndex(currentRoundIndex + 1);
            setQuestionIndex(0);
            return;
        }
        setAttempt(nextAttempt);
    }, [questionIndex, roundIndex]);

    const saveCurrentAnswer = async () => {
        const value = draft.trim();
        if (!value) { setError("Give an answer before continuing."); return; }
        setBusy(true); setError("");
        await pauseHandsFree();
        try {
            const body = followUp
                ? { roundIndex, questionIndex, followUpAnswer: value }
                : { roundIndex, questionIndex, answer: value };
            const { data } = await api.put(`${toolBase}/answer`, body, { headers: candidateHeaders, skipAuthRedirect: true });
            setDraft("");
            navigateAfterSave(data.attempt);
        } catch (requestError) {
            setError(requestError?.response?.data?.message || "Your answer could not be saved.");
            await resumeHandsFree(voiceTarget);
        } finally { setBusy(false); }
    };

    const saveWrittenAnswer = async () => {
        const value = draft.trim();
        if (!value) { setError("Write an answer before continuing."); return; }
        setBusy(true); setError("");
        try {
            const { data } = await api.put(`${toolBase}/answer`, { roundIndex, questionIndex, answer: value }, { headers: candidateHeaders, skipAuthRedirect: true });
            setAttempt(data.attempt);
            if (round?.questions?.[questionIndex + 1]) setQuestionIndex((index) => index + 1);
            else if (attempt?.rounds?.[roundIndex + 1]) { setRoundIndex((index) => index + 1); setQuestionIndex(0); }
        } catch (requestError) {
            setError(requestError?.response?.data?.message || "Your answer could not be saved.");
        } finally { setBusy(false); }
    };

    const finishSystemDesign = async () => {
        if (!draft.trim()) return false;
        setBusy(true); setError("");
        try {
            const { data } = await api.put(`${toolBase}/system-design/complete`, {
                roundIndex, questionIndex, transcript: draft, diagramData: diagram, previousInterjections: [],
            }, { headers: candidateHeaders, skipAuthRedirect: true });
            setAttempt(data.attempt);
            if (data.attempt?.rounds?.[roundIndex + 1]) { setRoundIndex((index) => index + 1); setQuestionIndex(0); }
            return true;
        } catch (requestError) {
            setError(requestError?.response?.data?.message || "Your system-design discussion could not be saved.");
            return false;
        } finally { setBusy(false); }
    };

    const submitAssessment = async () => {
        setBusy(true); setError(""); stopHandsFree();
        try {
            await api.post(`${toolBase}/submit`, {}, { headers: candidateHeaders, skipAuthRedirect: true });
            clearSaved(storageKey);
            setSubmitted(true);
        } catch (requestError) {
            setError(requestError?.response?.data?.message || "Your assessment could not be submitted.");
        } finally { setBusy(false); }
    };

    const allQuestionsAnswered = useMemo(() => attempt?.rounds?.every((item) => item.questions?.every((q) => Boolean(q.answer?.trim()))) ?? false, [attempt]);
    const completedCount = useMemo(() => attempt?.rounds?.reduce((sum, item) => sum + item.questions.filter((q) => q.answer?.trim()).length, 0) || 0, [attempt]);
    const totalCount = useMemo(() => attempt?.rounds?.reduce((sum, item) => sum + item.questions.length, 0) || 1, [attempt]);

    if (loading) return <Box sx={{ minHeight: "65vh", display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
    if (!assessment) return <Container maxWidth="sm" sx={{ py: 8 }}><Alert severity="error">{error || "Assessment unavailable."}</Alert></Container>;
    if (submitted) return (
        <Container maxWidth="sm" sx={{ py: 10 }}>
            <Paper variant="outlined" sx={{ p: 5, textAlign: "center", borderRadius: 4 }}>
                <CheckCircleRoundedIcon color="success" sx={{ fontSize: 64 }} />
                <Typography variant="h4" fontWeight={850} mt={2}>Assessment submitted</Typography>
                <Typography color="text.secondary" mt={1}>Your responses have been saved for the hiring team. You can close this page.</Typography>
            </Paper>
        </Container>
    );

    if (!attempt) return (
        <Container maxWidth="md" sx={{ py: { xs: 3, md: 7 } }}>
            <Stack spacing={2.5}>
                <Box>
                    <Chip label={assessment.organizationName || "Hiring assessment"} size="small" color="primary" variant="outlined" />
                    <Typography variant="h3" fontWeight={900} mt={1.5}>{assessment.title}</Typography>
                    <Typography variant="h6" color="text.secondary" mt={.5}>{assessment.jobRole}</Typography>
                    <Typography color="text.secondary" mt={1}>{assessment.durationMinutes} minutes · {assessment.rounds?.length || 0} round{assessment.rounds?.length === 1 ? "" : "s"}</Typography>
                </Box>
                {assessment.candidateInstructions && <Alert severity="info">{assessment.candidateInstructions}</Alert>}
                <Paper component="form" onSubmit={startAssessment} variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 4 }}>
                    <Stack spacing={2}>
                        <Typography variant="h6" fontWeight={850}>Join the interview</Typography>
                        <TextField label="Full name" required value={identity.name} onChange={(event) => setIdentity((current) => ({ ...current, name: event.target.value }))} />
                        <TextField label="Email" type="email" required value={identity.email} onChange={(event) => setIdentity((current) => ({ ...current, email: event.target.value }))} />
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <Button variant={micReady ? "contained" : "outlined"} onClick={requestMicrophone} startIcon={<MicRoundedIcon />}>{micReady ? "Microphone ready" : "Check microphone"}</Button>
                            {assessment.integrity?.requireCamera && <Button variant={cameraReady ? "contained" : "outlined"} onClick={requestCamera}>{cameraReady ? "Camera ready" : "Check camera"}</Button>}
                        </Stack>
                        <FormControlLabel control={<Checkbox checked={privacyConsent} onChange={(event) => setPrivacyConsent(event.target.checked)} />} label="I consent to processing my responses for this assessment." />
                        {assessment.integrity?.enabled && <FormControlLabel control={<Checkbox checked={integrityConsent} onChange={(event) => setIntegrityConsent(event.target.checked)} />} label="I consent to the integrity signals described for this assessment." />}
                        {error && <Alert severity="error">{error}</Alert>}
                        <Button type="submit" variant="contained" size="large" disabled={busy || !privacyConsent || (assessment.integrity?.enabled && !integrityConsent) || (assessment.integrity?.requireCamera && !cameraReady)}>
                            {busy ? "Starting…" : "Start assessment"}
                        </Button>
                    </Stack>
                </Paper>
            </Stack>
        </Container>
    );

    return (
        <Box sx={{ bgcolor: "background.default", minHeight: "calc(100vh - 64px)", py: 2 }}>
            <Container maxWidth={false} sx={{ maxWidth: 1500 }}>
                <Paper variant="outlined" sx={{ mb: 2, p: 1.5, borderRadius: 3, position: "sticky", top: 8, zIndex: 20, bgcolor: "background.paper" }}>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1.25} alignItems={{ md: "center" }}>
                        <Box>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                <Typography fontWeight={900}>{round?.name || "Assessment"}</Typography>
                                <Chip size="small" color="primary" variant="outlined" label={mode === "system-design" ? "System design" : mode === "online-assessment" ? "Coding / written" : "Conversation"} />
                                {!online && <Chip size="small" color="warning" label="Offline · recovery active" />}
                            </Stack>
                            <Typography variant="caption" color="text.secondary">Round {roundIndex + 1} of {attempt.rounds.length} · {assessment.title}</Typography>
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                            {lastSavedAt && <Typography variant="caption" color="text.secondary">Recovery saved</Typography>}
                            {assessment.integrity?.requireCamera && <Box sx={{ width: 130 }}><WebcamPreview required /></Box>}
                        </Stack>
                    </Stack>
                    <LinearProgress variant="determinate" value={Math.min(100, (completedCount / totalCount) * 100)} sx={{ mt: 1.25, height: 4, borderRadius: 999 }} />
                </Paper>

                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

                {mode === "system-design" ? (
                    <SystemDesignDiscussionPanel
                        problem={question?.text || ""}
                        transcript={draft}
                        onTranscriptChange={setDraft}
                        diagramData={diagram}
                        onDiagramChange={setDiagram}
                        target={voiceTarget}
                        checkpointEndpoint={`${toolBase}/system-design/checkpoint`}
                        checkpointHeaders={candidateHeaders}
                        skipAuthRedirect
                        supportsSTT={supportsSTT}
                        supportsTTS={supportsTTS}
                        listening={listening}
                        listeningTarget={listeningTarget}
                        interimText={interimText}
                        micLevel={micLevel}
                        micPermission={micPermission}
                        micSessionActive={micSessionActive}
                        handsFreePaused={handsFreePaused}
                        startHandsFree={startHandsFree}
                        pauseHandsFree={pauseHandsFree}
                        resumeHandsFree={resumeHandsFree}
                        stopHandsFree={stopHandsFree}
                        speakNow={speakNow}
                        onEnd={finishSystemDesign}
                        ending={busy}
                        savedLabel="Transcript and whiteboard are recovered automatically."
                    />
                ) : mode === "conversational" ? (
                    <Paper variant="outlined" sx={{ borderRadius: 4, overflow: "hidden" }}>
                        <Box sx={{ background: "linear-gradient(145deg,#07111f,#10243d)", color: "white", p: { xs: 3, md: 5 }, minHeight: 330, display: "grid", placeItems: "center", textAlign: "center", position: "relative" }}>
                            <Stack spacing={2.25} alignItems="center" maxWidth={850}>
                                <Chip color={listening && listeningTarget === voiceTarget ? "success" : "primary"} label={listening && listeningTarget === voiceTarget ? "Listening to you" : micSessionActive ? "Mic ready" : "Connecting microphone"} />
                                {followUp && <Typography variant="overline" sx={{ color: "#c4b5fd" }}>Interviewer follow-up</Typography>}
                                <Typography sx={{ fontSize: { xs: "1.35rem", md: "1.8rem" }, lineHeight: 1.45, fontWeight: 750 }}>{activePrompt}</Typography>
                                <Typography sx={{ color: "rgba(255,255,255,.65)" }}>Speak naturally. The microphone stays available and pauses automatically while the interviewer speaks.</Typography>
                                {interimText && <Typography sx={{ color: "rgba(255,255,255,.75)", fontStyle: "italic" }}>“{interimText}”</Typography>}
                            </Stack>
                            {assessment.integrity?.requireCamera && <Box sx={{ position: "absolute", right: 14, bottom: 14 }}><WebcamPreview required /></Box>}
                        </Box>
                        <Box sx={{ p: { xs: 2, md: 3 } }}>
                            <Stack spacing={2}>
                                <Box>
                                    <Typography variant="caption" fontWeight={850} color="text.secondary">LIVE TRANSCRIPT</Typography>
                                    <Paper variant="outlined" sx={{ p: 1.5, mt: .75, minHeight: 90, bgcolor: "action.hover" }}><Typography sx={{ whiteSpace: "pre-wrap" }}>{draft || "Your answer will appear here as you speak."}</Typography></Paper>
                                </Box>
                                <TextField label="Correct transcript or type instead" multiline minRows={3} value={draft} onChange={(event) => setDraft(event.target.value)} />
                                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
                                    <Button variant="outlined" onClick={() => speakPrompt(activePrompt)} disabled={!supportsTTS}>Replay question</Button>
                                    <Button variant="contained" startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <SendRoundedIcon />} onClick={saveCurrentAnswer} disabled={busy || !draft.trim()}>{followUp ? "Continue discussion" : "Finish this answer"}</Button>
                                </Stack>
                            </Stack>
                        </Box>
                    </Paper>
                ) : (
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "300px minmax(0,1fr)" }, gap: 2 }}>
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, alignSelf: "start", position: { lg: "sticky" }, top: { lg: 92 } }}>
                            <Typography fontWeight={900}>Problems</Typography>
                            <Stack spacing={.75} mt={1.5}>
                                {round?.questions?.map((item, index) => <Button key={item._id || index} variant={index === questionIndex ? "contained" : "text"} color={item.answer?.trim() ? "success" : "primary"} onClick={() => setQuestionIndex(index)} sx={{ justifyContent: "flex-start" }}>Problem {index + 1}{item.answer?.trim() ? " · saved" : ""}</Button>)}
                            </Stack>
                        </Paper>
                        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, minWidth: 0 }}>
                            <Typography variant="overline" color="text.secondary">Problem {questionIndex + 1} of {round?.questions?.length || 1}</Typography>
                            <Typography variant="h5" fontWeight={850} mt={.5}>{question?.text}</Typography>
                            <Divider sx={{ my: 2 }} />
                            <CodeEditorField
                                value={draft}
                                onChange={setDraft}
                                minRows={12}
                                suggestCode
                                draftKey={`candidate:${attempt._id}:${roundIndex}:${questionIndex}`}
                                executionEndpoint={`${toolBase}/run-code`}
                                executionHeaders={candidateHeaders}
                                skipAuthRedirect
                                canRun={assessment.capabilities?.codeExecution !== false}
                            />
                            <Stack direction="row" justifyContent="flex-end" mt={2}>
                                <Button variant="contained" onClick={saveWrittenAnswer} disabled={busy || !draft.trim()}>{busy ? "Saving…" : questionIndex + 1 < (round?.questions?.length || 0) ? "Save & next" : "Save problem"}</Button>
                            </Stack>
                        </Paper>
                    </Box>
                )}

                <Card variant="outlined" sx={{ mt: 2, borderRadius: 3 }}>
                    <CardContent>
                        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1.5} alignItems={{ sm: "center" }}>
                            <Box>
                                <Typography fontWeight={850}>Assessment progress</Typography>
                                <Typography variant="body2" color="text.secondary">Submit once you’ve completed every required response.</Typography>
                            </Box>
                            <Button variant="contained" color="success" disabled={busy || !allQuestionsAnswered} onClick={submitAssessment}>Submit assessment</Button>
                        </Stack>
                    </CardContent>
                </Card>
            </Container>
        </Box>
    );
}
