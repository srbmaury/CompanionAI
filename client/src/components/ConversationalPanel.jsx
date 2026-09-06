import { useState, useEffect, lazy, memo, Suspense, useMemo, useCallback } from "react";
import SoundWave from "./SoundWave";
import { useElapsed } from "../hooks/useElapsed";
import {
    Box, Button, Chip, CircularProgress, Dialog, DialogActions,
    DialogContent, DialogContentText, DialogTitle, Paper,
    Skeleton, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import SendIcon from "@mui/icons-material/Send";
import NotesRoundedIcon from "@mui/icons-material/NotesRounded";
import SkipRoundButton from "./SkipRoundButton";
import WebcamPreview from "./WebcamPreview";

const CodeEditorField = lazy(() => import("./CodeEditorField"));

const ConversationalPanel = ({
    convSubmitting,
    convRoundSubmitting,
    convState,
    convAnswer,
    setConvAnswer,
    spokenAnswer,
    setSpokenAnswer,
    codingEnabled,
    onCodingModeChange,
    codeDraftKey,
    codeEditorProps = {},
    onSubmitAnswer,
    onCompleteRound,
    onClarify,
    onSkip,
    supportsTTS,
    supportsSTT,
    listening,
    listeningTarget,
    interimText,
    onSpeak,
    outlinedInputSx,
    savedAt,
    pendingFollowUp,
    onFollowUpDone,
    micSessionActive,
    handsFreePaused,
    onStartHandsFree,
    onPauseHandsFree,
    onResumeHandsFree,
    onStopHandsFree,
    target = "conv",
    showRoundControls = true,
    allowFollowUpSkip = true,
    showFollowUpCount = false,
    submitAnswerLabel = "I’m done",
    submitFollowUpLabel = "I’m done",
    cameraSlot,
}) => {
    const [clarifyText, setClarifyText] = useState("");
    const [submitRoundOpen, setSubmitRoundOpen] = useState(false);
    const [aiSpeaking, setAiSpeaking] = useState(false);
    const [showTypedAnswer, setShowTypedAnswer] = useState(false);
    const elapsedLabel = useElapsed();

    const questionNumber = useMemo(() => (convState?.index ?? 0) + 1, [convState?.index]);
    const questionText = convState?.current?.text;
    const isRecording = listening && listeningTarget === target;
    const activeText = pendingFollowUp?.question || questionText || "";
    const isFollowUp = Boolean(pendingFollowUp);
    const isDone = convState?.done;
    const typedWorkspaceVisible = showTypedAnswer || codingEnabled || !supportsSTT;

    const savedLabel = useMemo(() => {
        if (!savedAt) return null;
        const timestamp = typeof savedAt === "number" ? savedAt : new Date(savedAt).getTime();
        if (!Number.isFinite(timestamp)) return "Recovery active";
        const diff = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
        if (diff < 3) return "Saved just now";
        if (diff < 60) return `Saved ${diff}s ago`;
        return `Saved ${Math.floor(diff / 60)}m ago`;
    }, [savedAt]);

    const interviewerState = useMemo(() => {
        if (isDone) return { label: "Round complete", color: "success" };
        if (convSubmitting || convRoundSubmitting) return { label: "One moment…", color: "info" };
        if (aiSpeaking) return { label: "Interviewer speaking", color: "primary" };
        if (isRecording) return { label: "Listening", color: "success" };
        if (micSessionActive) return { label: "Your turn", color: "success" };
        return { label: supportsSTT ? "Connecting mic…" : "Your turn", color: supportsSTT ? "default" : "success" };
    }, [aiSpeaking, convRoundSubmitting, convSubmitting, isDone, isRecording, micSessionActive, supportsSTT]);

    const triggerSpeak = useCallback(async (text) => {
        if (!text) return;
        await onPauseHandsFree?.();
        if (supportsTTS) {
            setAiSpeaking(true);
            await onSpeak?.(text);
            setAiSpeaking(false);
        }
        if (!isDone && !convSubmitting && !convRoundSubmitting) await onResumeHandsFree?.(target);
    }, [convRoundSubmitting, convSubmitting, isDone, onPauseHandsFree, onResumeHandsFree, onSpeak, supportsTTS, target]);

    useEffect(() => {
        if (!supportsSTT || !activeText || isDone || convRoundSubmitting) return;
        let cancelled = false;
        (async () => {
            if (!micSessionActive) await onStartHandsFree?.(target);
            else if (handsFreePaused && !aiSpeaking && !convSubmitting) await onResumeHandsFree?.(target);
            if (cancelled) return;
        })();
        return () => { cancelled = true; };
    }, [activeText, aiSpeaking, convRoundSubmitting, convSubmitting, handsFreePaused, isDone, micSessionActive, onResumeHandsFree, onStartHandsFree, supportsSTT, target]);

    useEffect(() => {
        if (!supportsTTS || !questionText) return;
        const timer = setTimeout(() => { triggerSpeak(questionText); }, 350);
        return () => clearTimeout(timer);
    }, [questionText]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!supportsTTS || !pendingFollowUp?.question) return;
        const timer = setTimeout(() => { triggerSpeak(pendingFollowUp.question); }, 350);
        return () => clearTimeout(timer);
    }, [pendingFollowUp?.question]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => () => { onStopHandsFree?.(); }, [onStopHandsFree]);

    const submitClarify = () => {
        const value = clarifyText.trim();
        if (value && onClarify) {
            onClarify(value);
            setClarifyText("");
        }
    };

    const submitAnswerTurn = async () => {
        await onPauseHandsFree?.();
        await onSubmitAnswer?.();
    };

    const submitFollowUpTurn = async (skip = false) => {
        await onPauseHandsFree?.();
        await onFollowUpDone?.({ skip });
    };

    const endRound = async () => {
        setSubmitRoundOpen(false);
        onStopHandsFree?.();
        await onCompleteRound?.();
    };

    const skipRound = async () => {
        onStopHandsFree?.();
        await onSkip?.();
    };

    return (
        <Box sx={{ borderRadius: 3, overflow: "hidden", border: "1px solid", borderColor: "divider", boxShadow: "0 16px 48px rgba(15,23,42,.08)" }}>
            <Box sx={{ position: "relative", minHeight: { xs: 340, sm: 410, md: 450 }, background: "linear-gradient(160deg, #050d1a 0%, #0d1628 55%, #081422 100%)", backgroundImage: ["linear-gradient(160deg, #050d1a 0%, #0d1628 55%, #081422 100%)", "radial-gradient(rgba(255,255,255,0.022) 1px, transparent 1px)"].join(", "), backgroundSize: "100%, 28px 28px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "center", px: { xs: 1.5, sm: 2 }, py: 1.5, background: "linear-gradient(rgba(0,0,0,.62), transparent)" }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: isDone ? "success.main" : isRecording ? "success.main" : "warning.main", animation: isRecording ? "blink 1.4s ease-in-out infinite" : "none", "@keyframes blink": { "0%,100%": { opacity: 1 }, "50%": { opacity: .35 } } }} />
                        <Typography sx={{ color: "rgba(255,255,255,.76)", fontSize: ".72rem", fontWeight: 700, letterSpacing: .45, textTransform: "uppercase" }}>{isDone ? "Completed" : "Live interview"}</Typography>
                        {!isDone && <Chip size="small" label={`Q ${questionNumber}`} sx={{ height: 20, bgcolor: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.8)" }} />}
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                        {!isDone && <Chip size="small" label={interviewerState.label} color={interviewerState.color} sx={{ display: { xs: "none", sm: "flex" }, height: 22 }} />}
                        {supportsTTS && activeText && !isDone && (
                            <Tooltip title="Replay question"><Button size="small" onClick={() => triggerSpeak(activeText)} startIcon={<VolumeUpIcon sx={{ fontSize: 18 }} />} sx={{ color: "rgba(255,255,255,.72)", minWidth: 0 }}>Replay</Button></Tooltip>
                        )}
                        <Box sx={{ px: 1, py: .35, bgcolor: "rgba(0,0,0,.4)", borderRadius: 1.5, border: "1px solid rgba(255,255,255,.1)" }}><Typography sx={{ color: "rgba(255,255,255,.75)", fontSize: ".72rem", fontFamily: "monospace" }}>{elapsedLabel}</Typography></Box>
                    </Stack>
                </Box>

                {isDone ? (
                    <Stack alignItems="center" spacing={2} py={5}><Typography sx={{ color: "white", fontSize: 36 }}>✓</Typography><Typography sx={{ color: "rgba(255,255,255,.9)", fontWeight: 700, fontSize: "1.2rem" }}>Round complete</Typography></Stack>
                ) : !convState?.current && !convSubmitting ? (
                    <Stack direction="row" spacing={1.5} alignItems="center" color="rgba(255,255,255,.65)"><CircularProgress size={20} sx={{ color: "rgba(255,255,255,.5)" }} /><Typography>Preparing the interview…</Typography></Stack>
                ) : (
                    <Stack spacing={2.5} alignItems="center" sx={{ width: "100%", maxWidth: 820, px: { xs: 2, sm: 4 }, pt: 5, pb: 6 }}>
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.25 }}>
                            <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {aiSpeaking && [1, 2].map((ring) => <Box key={ring} sx={{ position: "absolute", width: 92 + ring * 24, height: 92 + ring * 24, borderRadius: "50%", border: "2px solid rgba(96,165,250,.8)", opacity: 0, animation: "aiPulse 1.8s ease-out infinite", animationDelay: `${ring * .45}s`, "@keyframes aiPulse": { "0%": { transform: "scale(.85)", opacity: .5 }, "100%": { transform: "scale(1.22)", opacity: 0 } } }} />)}
                                <Box sx={{ width: 86, height: 86, borderRadius: "50%", background: "linear-gradient(145deg, #2563eb 0%, #1e40af 100%)", display: "grid", placeItems: "center", boxShadow: aiSpeaking ? "0 0 0 4px rgba(96,165,250,.25), 0 12px 36px rgba(0,0,0,.45)" : "0 12px 36px rgba(0,0,0,.4)", position: "relative", zIndex: 1 }}><PersonRoundedIcon sx={{ fontSize: 48, color: "white" }} /></Box>
                            </Box>
                            <Stack direction="row" spacing={1.25} alignItems="center"><SoundWave active={aiSpeaking} /><Typography sx={{ color: "rgba(255,255,255,.7)", fontSize: ".75rem", fontWeight: 700, letterSpacing: .5, textTransform: "uppercase" }}>Interviewer</Typography><SoundWave active={aiSpeaking} /></Stack>
                        </Box>
                        <Paper elevation={0} sx={{ width: "100%", px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 2.5 }, bgcolor: "rgba(255,255,255,.08)", color: "white", border: "1px solid rgba(255,255,255,.12)", borderRadius: 3, backdropFilter: "blur(8px)" }}>
                            {isFollowUp && <Chip size="small" label={showFollowUpCount ? `Follow-up ${pendingFollowUp?.number || 1}` : "Follow-up"} sx={{ mb: 1, bgcolor: "rgba(168,85,247,.22)", color: "#e9d5ff" }} />}
                            <Typography component="h2" sx={{ fontSize: { xs: "1rem", sm: "1.18rem", md: "1.28rem" }, lineHeight: 1.55, fontWeight: 600, color: "rgba(255,255,255,.96)" }}>{activeText || " "}</Typography>
                        </Paper>
                    </Stack>
                )}
                {cameraSlot === undefined ? <WebcamPreview /> : cameraSlot}
            </Box>

            <Box sx={{ bgcolor: "background.paper", p: { xs: 2, sm: 2.5, md: 3 } }}>
                {(pendingFollowUp || (convState?.current && !convState?.done)) && !convSubmitting && (
                    <Stack spacing={2.25}>
                        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: .7, minWidth: { md: 140 } }}>
                                <Box sx={{ position: "relative", borderRadius: "50%", width: 72, height: 72, display: "grid", placeItems: "center", bgcolor: isRecording ? "success.main" : micSessionActive ? "success.light" : "action.hover", color: isRecording ? "white" : "text.secondary", boxShadow: isRecording ? 8 : 1 }}><MicIcon sx={{ fontSize: 32, position: "relative", zIndex: 1 }} /></Box>
                                <Typography variant="caption" color={isRecording ? "success.main" : "text.secondary"} fontWeight={isRecording ? 700 : 500} textAlign="center">{isRecording ? "Mic live" : micSessionActive ? "Mic stays ready" : supportsSTT ? "Connecting mic" : "Voice unavailable"}</Typography>
                                {!micSessionActive && supportsSTT && <Button size="small" onClick={() => onStartHandsFree?.(target)}>Enable mic</Button>}
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
                                <Typography fontWeight={800}>{isRecording ? "Speak naturally — I’m listening" : aiSpeaking ? "The interviewer has the floor" : "Your response"}</Typography>
                                <Typography variant="body2" color="text.secondary" mt={.25}>The microphone stays available and pauses automatically while the interviewer speaks. Continue when you are ready; finish the turn explicitly.</Typography>
                                {isRecording && interimText && <Typography variant="body2" sx={{ mt: 1, fontStyle: "italic", color: "text.secondary" }}>“{interimText}”</Typography>}
                                {!typedWorkspaceVisible && convAnswer?.trim() && <Paper variant="outlined" sx={{ mt: 1.25, p: 1.5, bgcolor: "action.hover", maxHeight: 120, overflow: "auto" }}><Typography variant="caption" color="text.secondary" fontWeight={700}>LIVE TRANSCRIPT</Typography><Typography variant="body2" mt={.5}>{convAnswer}</Typography></Paper>}
                            </Box>
                            {supportsSTT && !codingEnabled && <Button variant={typedWorkspaceVisible ? "contained" : "outlined"} startIcon={<NotesRoundedIcon />} onClick={() => setShowTypedAnswer((current) => !current)} sx={{ flexShrink: 0 }}>{typedWorkspaceVisible ? "Hide typing" : "Type / code"}</Button>}
                        </Stack>

                        {typedWorkspaceVisible && (
                            <Suspense fallback={<Skeleton variant="rectangular" height={180} sx={{ borderRadius: 2 }} />}>
                                <CodeEditorField value={convAnswer} onChange={setConvAnswer} onModeChange={onCodingModeChange} draftKey={codeDraftKey} suggestCode={/\b(code|implement|algorithm|data structure|complexity|function|program)\b/i.test(questionText || "")} outlinedInputSx={outlinedInputSx} minRows={7} {...codeEditorProps} />
                            </Suspense>
                        )}

                        {codingEnabled && <TextField label="Explain your approach" value={spokenAnswer || ""} onChange={(event) => setSpokenAnswer?.(event.target.value)} multiline minRows={3} fullWidth helperText="Keep your verbal reasoning separate from the code." />}

                        {pendingFollowUp ? (
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="flex-end">
                                {allowFollowUpSkip && <Button variant="outlined" onClick={() => submitFollowUpTurn(true)}>Move on</Button>}
                                <Button variant="contained" startIcon={<SendIcon />} onClick={() => submitFollowUpTurn(false)} disabled={!String(convAnswer || "").trim()} sx={{ minWidth: 150 }}>{submitFollowUpLabel}</Button>
                            </Stack>
                        ) : (
                            <Stack direction={{ xs: "column", lg: "row" }} spacing={1.25} alignItems={{ lg: "center" }}>
                                <Button variant="contained" startIcon={convSubmitting ? <CircularProgress size={16} color="inherit" /> : <SendIcon />} onClick={submitAnswerTurn} disabled={convSubmitting || !String(convAnswer || "").trim()} sx={{ minWidth: 150, order: { xs: 1, lg: 3 } }}>{convSubmitting ? "One moment…" : submitAnswerLabel}</Button>
                                {onClarify && <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ flex: 1, minWidth: 0, width: "100%", order: { xs: 2, lg: 1 } }}><TextField size="small" placeholder="Need clarification? Ask the interviewer…" fullWidth value={clarifyText} onChange={(event) => setClarifyText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitClarify(); }} /><Button variant="outlined" size="small" onClick={submitClarify} disabled={!clarifyText.trim()}>Ask</Button></Stack>}
                                {showRoundControls && (onCompleteRound || onSkip) && <Stack direction="row" spacing={1} sx={{ order: { xs: 3, lg: 2 } }}>{onCompleteRound && <Button variant="text" size="small" color="inherit" onClick={() => setSubmitRoundOpen(true)} disabled={convRoundSubmitting}>End round</Button>}{onSkip && <SkipRoundButton onSkip={skipRound} />}</Stack>}
                            </Stack>
                        )}
                        {savedLabel && <Typography variant="caption" color="text.secondary" textAlign="right">{savedLabel}</Typography>}
                    </Stack>
                )}

                {convSubmitting && <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 2 }}><CircularProgress size={20} /><Typography fontWeight={700}>One moment…</Typography></Stack>}
                {convState?.done && !convSubmitting && <Typography color="success.main" fontWeight={700} sx={{ py: 1 }}>Round complete.</Typography>}

                <Dialog open={submitRoundOpen} onClose={() => setSubmitRoundOpen(false)} aria-labelledby="submit-round-title">
                    <DialogTitle id="submit-round-title">End this round?</DialogTitle>
                    <DialogContent><DialogContentText>This closes the live round and moves you forward. You can review feedback after the interview is complete.</DialogContentText></DialogContent>
                    <DialogActions><Button onClick={() => setSubmitRoundOpen(false)}>Keep interviewing</Button><Button variant="contained" onClick={endRound}>End round</Button></DialogActions>
                </Dialog>
            </Box>
        </Box>
    );
};

export default memo(ConversationalPanel);
