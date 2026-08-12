import { useState, useEffect, lazy, memo, Suspense, useMemo, useRef, useCallback } from "react";
import SoundWave from "./SoundWave";
import { useElapsed } from "../hooks/useElapsed";
import {
    Box, Button, Chip, CircularProgress, Dialog, DialogActions,
    DialogContent, DialogContentText, DialogTitle, IconButton,
    Skeleton, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import SendIcon from "@mui/icons-material/Send";
import SkipRoundButton from "./SkipRoundButton";
import WebcamPreview from "./WebcamPreview";

const CodeEditorField = lazy(() => import("./CodeEditorField"));

// ── Main component ────────────────────────────────────────────────────────────
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
    onStartListening,
    onStopListening,
    outlinedInputSx,
    savedAt,
    pendingFollowUp,
    onFollowUpDone,
}) => {
    const [clarifyText, setClarifyText] = useState("");
    const [submitRoundOpen, setSubmitRoundOpen] = useState(false);
    const [aiSpeaking, setAiSpeaking] = useState(false);
    const speakCheckRef = useRef(null);
    const elapsedLabel = useElapsed();

    const questionNumber = useMemo(() => (convState?.index ?? 0) + 1, [convState?.index]);
    const questionText = convState?.current?.text;
    const isRecording = listening && listeningTarget === "conv";

    const savedLabel = useMemo(() => {
        if (!savedAt) return null;
        const diff = Math.floor((Date.now() - savedAt) / 1000);
        if (diff < 3) return "Saved just now";
        if (diff < 60) return `Saved ${diff}s ago`;
        return `Saved ${Math.floor(diff / 60)}m ago`;
    }, [savedAt]);

    // Track speaking state by polling speechSynthesis
    const triggerSpeak = useCallback((text) => {
        onSpeak?.(text);
        setAiSpeaking(true);
        if (speakCheckRef.current) clearInterval(speakCheckRef.current);
        const poll = setTimeout(() => {
            speakCheckRef.current = setInterval(() => {
                if (typeof window === "undefined" || !window.speechSynthesis?.speaking) {
                    setAiSpeaking(false);
                    if (speakCheckRef.current) { clearInterval(speakCheckRef.current); speakCheckRef.current = null; }
                }
            }, 400);
        }, 700);
        return () => { clearTimeout(poll); if (speakCheckRef.current) { clearInterval(speakCheckRef.current); speakCheckRef.current = null; } };
    }, [onSpeak]);

    useEffect(() => {
        if (!supportsTTS || !questionText) return;
        let cleanup;
        const t = setTimeout(() => { cleanup = triggerSpeak(questionText); }, 400);
        return () => { clearTimeout(t); cleanup?.(); };
    }, [questionText]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!supportsTTS || !pendingFollowUp?.question) return;
        let cleanup;
        const t = setTimeout(() => { cleanup = triggerSpeak(pendingFollowUp.question); }, 400);
        return () => { clearTimeout(t); cleanup?.(); };
    }, [pendingFollowUp?.question]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => () => { if (speakCheckRef.current) clearInterval(speakCheckRef.current); }, []);

    const submitClarify = () => {
        const val = clarifyText.trim();
        if (val && onClarify) { onClarify(val); setClarifyText(""); }
    };

    // ── Interview Room (the dark video-call area) ─────────────────────────────
    const activeText = pendingFollowUp?.question || questionText || "";
    const isFollowUp = Boolean(pendingFollowUp);
    const isDone = convState?.done;

    const RoomContent = () => {
        if (isDone) {
            return (
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, py: 4 }}>
                    <Box sx={{
                        width: 72, height: 72, borderRadius: "50%",
                        background: "linear-gradient(135deg, #2e7d32, #1b5e20)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <Typography sx={{ fontSize: 32 }}>✓</Typography>
                    </Box>
                    <Typography sx={{ color: "rgba(255,255,255,0.85)", fontWeight: 600, fontSize: "1.1rem" }}>
                        Round Complete
                    </Typography>
                </Box>
            );
        }

        if (!convState?.current && !convSubmitting) {
            return (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, color: "rgba(255,255,255,0.6)" }}>
                    <CircularProgress size={20} sx={{ color: "rgba(255,255,255,0.4)" }} />
                    <Typography>Loading question…</Typography>
                </Box>
            );
        }

        return (
            <>
                {/* AI Avatar */}
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
                    {/* Avatar with pulse rings */}
                    <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {aiSpeaking && [1, 2].map((ring) => (
                            <Box key={ring} sx={{
                                position: "absolute",
                                width: 96 + ring * 28,
                                height: 96 + ring * 28,
                                borderRadius: "50%",
                                border: "2px solid",
                                borderColor: "primary.main",
                                opacity: 0,
                                animation: `aiPulse 1.8s ease-out infinite`,
                                animationDelay: `${ring * 0.5}s`,
                                "@keyframes aiPulse": {
                                    "0%": { transform: "scale(0.85)", opacity: 0.5 },
                                    "100%": { transform: "scale(1.2)", opacity: 0 },
                                },
                            }} />
                        ))}
                        <Box sx={{
                            width: 88,
                            height: 88,
                            borderRadius: "50%",
                            background: "linear-gradient(145deg, #1565C0 0%, #0D47A1 60%, #01579B 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: aiSpeaking
                                ? "0 0 0 3px rgba(25,118,210,0.4), 0 8px 32px rgba(0,0,0,0.5)"
                                : "0 8px 32px rgba(0,0,0,0.5)",
                            transition: "box-shadow 0.4s ease",
                            position: "relative",
                            zIndex: 1,
                        }}>
                            <SmartToyIcon sx={{ fontSize: 44, color: "white" }} />
                        </Box>
                    </Box>

                    {/* Sound wave + status */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <SoundWave active={aiSpeaking} />
                        <Typography sx={{
                            color: "rgba(255,255,255,0.6)",
                            fontSize: "0.72rem",
                            fontWeight: 500,
                            letterSpacing: 0.4,
                            textTransform: "uppercase",
                        }}>
                            {convSubmitting ? "Processing…" : aiSpeaking ? "Speaking" : "AI Interviewer"}
                        </Typography>
                        <SoundWave active={aiSpeaking} />
                    </Box>
                </Box>

                {/* Question text overlay at bottom of room */}
                <Box sx={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 150, // leave room for PiP
                    px: 2.5,
                    pb: 1.5,
                    pt: 3,
                    background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                }}>
                    {isFollowUp && (
                        <Chip
                            size="small"
                            label="Follow-up"
                            color="secondary"
                            sx={{ mb: 0.5, height: 18, fontSize: "0.65rem" }}
                        />
                    )}
                    <Typography sx={{
                        color: "rgba(255,255,255,0.92)",
                        fontSize: { xs: "0.82rem", sm: "0.9rem" },
                        lineHeight: 1.5,
                        fontWeight: 400,
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                    }}>
                        {activeText || " "}
                    </Typography>
                </Box>
            </>
        );
    };

    return (
        <Box sx={{ borderRadius: 3, overflow: "hidden", border: "1px solid", borderColor: "divider" }}>

            {/* ── Interview Room ──────────────────────────────────────────────── */}
            <Box sx={{
                position: "relative",
                minHeight: { xs: 260, sm: 320 },
                background: "linear-gradient(160deg, #050d1a 0%, #0d1628 55%, #081422 100%)",
                backgroundImage: [
                    "linear-gradient(160deg, #050d1a 0%, #0d1628 55%, #081422 100%)",
                    "radial-gradient(rgba(255,255,255,0.022) 1px, transparent 1px)",
                ].join(", "),
                backgroundSize: "100%, 28px 28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
            }}>
                {/* Top bar */}
                <Box sx={{
                    position: "absolute",
                    top: 0, left: 0, right: 0,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    px: 2,
                    pt: 1.5,
                    pb: 1,
                    background: "linear-gradient(rgba(0,0,0,0.55), transparent)",
                }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{
                            width: 8, height: 8, borderRadius: "50%",
                            bgcolor: convState?.done ? "success.main" : "error.main",
                            animation: convState?.done ? "none" : "blink 2s ease-in-out infinite",
                            "@keyframes blink": { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.4 } },
                        }} />
                        <Typography sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.7rem", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>
                            {convState?.done ? "Completed" : "Live Interview"}
                        </Typography>
                        {!isDone && (
                            <Chip
                                size="small"
                                label={`Q ${questionNumber}`}
                                sx={{ height: 18, fontSize: "0.65rem", bgcolor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)", border: "none" }}
                            />
                        )}
                        {savedLabel && (
                            <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.65rem" }}>
                                · {savedLabel}
                            </Typography>
                        )}
                    </Stack>

                    <Stack direction="row" spacing={1} alignItems="center">
                        {convRoundSubmitting && (
                            <Chip size="small" label="Evaluating…" color="info"
                                sx={{ height: 18, fontSize: "0.65rem" }} />
                        )}
                        {supportsTTS && activeText && !isDone && (
                            <Tooltip title="Replay question">
                                <IconButton
                                    size="small"
                                    onClick={() => triggerSpeak(activeText)}
                                    sx={{ color: "rgba(255,255,255,0.55)", "&:hover": { color: "white" }, p: 0.5 }}
                                    aria-label="Replay question"
                                >
                                    <VolumeUpIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                            </Tooltip>
                        )}
                        <Box sx={{
                            px: 1, py: 0.25,
                            bgcolor: "rgba(0,0,0,0.45)",
                            borderRadius: 1,
                            border: "1px solid rgba(255,255,255,0.1)",
                        }}>
                            <Typography sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.7rem", fontFamily: "monospace" }}>
                                {elapsedLabel}
                            </Typography>
                        </Box>
                    </Stack>
                </Box>

                {/* Room content (avatar + question) */}
                <RoomContent />

                {/* User camera PiP */}
                <WebcamPreview />
            </Box>

            {/* ── Answer area ────────────────────────────────────────────────── */}
            <Box sx={{ bgcolor: "background.paper", p: { xs: 2, sm: 2.5 } }}>

                {/* ── Follow-up / Active question answer UI ── */}
                {(pendingFollowUp || (convState?.current && !convState?.done)) && !convSubmitting && (

                    <Stack spacing={2}>
                        {/* Mic button */}
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.75, py: 1 }}>
                            <Box sx={{ position: "relative" }}>
                                {isRecording && (
                                    <Box sx={{
                                        position: "absolute",
                                        inset: -10,
                                        borderRadius: "50%",
                                        bgcolor: "error.light",
                                        animation: "micRipple 1.4s ease-out infinite",
                                        "@keyframes micRipple": {
                                            "0%": { transform: "scale(1)", opacity: 0.3 },
                                            "100%": { transform: "scale(1.9)", opacity: 0 },
                                        },
                                    }} />
                                )}
                                <Button
                                    variant={isRecording ? "contained" : "outlined"}
                                    color={isRecording ? "error" : "primary"}
                                    onClick={() => isRecording ? onStopListening() : onStartListening("conv")}
                                    disabled={!supportsSTT || convSubmitting}
                                    sx={{
                                        borderRadius: "50%",
                                        width: 72,
                                        height: 72,
                                        minWidth: 0,
                                        position: "relative",
                                        zIndex: 1,
                                        boxShadow: isRecording ? 6 : 1,
                                        transition: "all 0.2s ease",
                                    }}
                                    aria-label={isRecording ? "Stop recording" : "Start recording"}
                                >
                                    {isRecording ? <MicOffIcon sx={{ fontSize: 32 }} /> : <MicIcon sx={{ fontSize: 32 }} />}
                                </Button>
                            </Box>
                            <Typography variant="caption" color={isRecording ? "error.main" : "text.secondary"} fontWeight={isRecording ? 600 : 400}>
                                {isRecording ? "Recording — tap to stop" : spokenAnswer ? "Tap to add more" : "Tap to speak"}
                            </Typography>
                            {isRecording && interimText && (
                                <Typography variant="body2" sx={{ fontStyle: "italic", color: "text.secondary", textAlign: "center", maxWidth: 480, opacity: 0.85 }}>
                                    {interimText}
                                </Typography>
                            )}
                        </Box>

                        {/* Text answer */}
                        <Suspense fallback={<Skeleton variant="rectangular" height={140} sx={{ borderRadius: 1 }} />}>
                            <CodeEditorField
                                value={convAnswer}
                                onChange={setConvAnswer}
                                onModeChange={onCodingModeChange}
                                draftKey={codeDraftKey}
                                suggestCode={/\b(code|implement|algorithm|data structure|complexity|function|program)\b/i.test(questionText || "")}
                                outlinedInputSx={outlinedInputSx}
                            />
                        </Suspense>

                        {codingEnabled && <TextField
                            label="Spoken explanation"
                            value={spokenAnswer || ""}
                            onChange={(event) => setSpokenAnswer(event.target.value)}
                            multiline
                            minRows={3}
                            fullWidth
                            helperText="Voice transcription stays separate from the written or code answer."
                        />}

                        {/* Actions */}
                        {pendingFollowUp ? (
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                <Button
                                    variant="contained"
                                    startIcon={<SendIcon />}
                                    onClick={() => onFollowUpDone()}
                                    sx={{ minWidth: 160 }}
                                >
                                    Submit Follow-up
                                </Button>
                                <Button variant="outlined" onClick={() => onFollowUpDone({ skip: true })}>
                                    Skip follow-up
                                </Button>
                            </Stack>
                        ) : (
                            <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
                                <Button
                                    variant="contained"
                                    startIcon={convSubmitting ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                                    onClick={onSubmitAnswer}
                                    disabled={convSubmitting}
                                    sx={{ minWidth: 160 }}
                                >
                                    {convSubmitting ? "Submitting…" : "Submit Answer"}
                                </Button>

                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ flex: 1, minWidth: 0, width: "100%" }}>
                                    <TextField
                                        size="small"
                                        placeholder="Ask a clarification…"
                                        fullWidth
                                        value={clarifyText}
                                        onChange={(e) => setClarifyText(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter") submitClarify(); }}
                                    />
                                    <Button variant="outlined" size="small" onClick={submitClarify}>
                                        Clarify
                                    </Button>
                                </Stack>

                                <Stack direction="row" spacing={1}>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() => setSubmitRoundOpen(true)}
                                        disabled={convRoundSubmitting}
                                    >
                                        {convRoundSubmitting ? "Evaluating…" : "End Round"}
                                    </Button>
                                    <SkipRoundButton onSkip={onSkip} />
                                </Stack>
                            </Stack>
                        )}
                    </Stack>
                )}

                {/* ── Submitting spinner ── */}
                {convSubmitting && !pendingFollowUp && (
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 2 }}>
                        <CircularProgress size={20} />
                        <Typography color="text.secondary">Processing your answer…</Typography>
                    </Stack>
                )}

                {/* ── Round done ── */}
                {convState?.done && !convSubmitting && (
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
                        <Typography color="success.main" fontWeight={600}>Round completed — feedback is generating.</Typography>
                    </Stack>
                )}

                {/* ── Loading questions ── */}
                {!convState?.current && !convState?.done && !convSubmitting && !pendingFollowUp && (
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 2 }}>
                        <CircularProgress size={20} />
                        <Typography color="text.secondary">Loading first question…</Typography>
                    </Stack>
                )}

                {/* Submit Round confirmation dialog */}
                <Dialog open={submitRoundOpen} onClose={() => setSubmitRoundOpen(false)} aria-labelledby="submit-round-title">
                    <DialogTitle id="submit-round-title">End this round?</DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            This will submit your answered questions, generate feedback, and close the round. Unanswered questions won’t receive feedback.
                        </DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setSubmitRoundOpen(false)}>Cancel</Button>
                        <Button variant="contained" onClick={() => { setSubmitRoundOpen(false); onCompleteRound(); }}>
                            End Round
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </Box>
    );
};

export default memo(ConversationalPanel);
