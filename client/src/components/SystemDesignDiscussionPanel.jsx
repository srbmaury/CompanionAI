import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert, Box, Button, Chip, CircularProgress, Divider, Paper, Skeleton,
    Stack, TextField, Typography,
} from "@mui/material";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";
import RecordVoiceOverRoundedIcon from "@mui/icons-material/RecordVoiceOverRounded";
import StopCircleRoundedIcon from "@mui/icons-material/StopCircleRounded";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import { useSystemDesignDiscussion } from "../hooks/useSystemDesignDiscussion";
import { countDiscussionWords, MIN_END_DISCUSSION_WORDS } from "../utils/systemDesignDiscussion";

const SystemDesignCanvas = lazy(() => import("./SystemDesignCanvas"));

const KIND_LABELS = {
    clarify: "Clarification",
    challenge: "Challenge",
    constraint: "New constraint",
    scale: "Scale change",
    failure: "Failure scenario",
    tradeoff: "Trade-off",
    security: "Security",
    observability: "Observability",
};

export default function SystemDesignDiscussionPanel({
    problem,
    transcript,
    onTranscriptChange,
    diagramData,
    onDiagramChange,
    target,
    checkpointEndpoint,
    checkpointHeaders,
    skipAuthRedirect = false,
    supportsSTT,
    supportsTTS,
    listening,
    listeningTarget,
    interimText,
    micLevel = 0,
    micPermission = "unknown",
    micSessionActive,
    handsFreePaused,
    startHandsFree,
    pauseHandsFree,
    resumeHandsFree,
    stopHandsFree,
    speakNow,
    onEnd,
    ending = false,
    savedLabel,
    cameraSlot = null,
}) {
    const [aiSpeaking, setAiSpeaking] = useState(false);
    const [latestInterviewerPrompt, setLatestInterviewerPrompt] = useState("");
    const [showTranscriptEditor, setShowTranscriptEditor] = useState(false);
    const spokenProblemRef = useRef("");
    const mountedRef = useRef(true);
    const threadEndRef = useRef(null);
    const isListening = listening && listeningTarget === target;
    const discussionWords = countDiscussionWords(transcript || "");
    const canEndDiscussion = discussionWords >= MIN_END_DISCUSSION_WORDS;

    useEffect(() => () => { mountedRef.current = false; stopHandsFree?.(); }, [stopHandsFree]);

    const speakInterviewer = useCallback(async (text, { remember = true } = {}) => {
        if (!text) return;
        if (remember) setLatestInterviewerPrompt(text);
        await pauseHandsFree?.();
        if (supportsTTS) {
            setAiSpeaking(true);
            await speakNow?.(text);
            if (mountedRef.current) setAiSpeaking(false);
        }
        if (mountedRef.current) await resumeHandsFree?.(target);
    }, [pauseHandsFree, resumeHandsFree, speakNow, supportsTTS, target]);

    const onInterjection = useCallback(async (item) => {
        await speakInterviewer(item.text);
    }, [speakInterviewer]);

    const { interjections } = useSystemDesignDiscussion({
        enabled: Boolean(problem && checkpointEndpoint),
        endpoint: checkpointEndpoint,
        headers: checkpointHeaders,
        transcript,
        diagramData,
        interimText,
        micLevel,
        listening: isListening,
        interviewerSpeaking: aiSpeaking,
        onInterjection,
        skipAuthRedirect,
    });

    useEffect(() => {
        threadEndRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    }, [interjections.length]);

    useEffect(() => {
        if (!problem || spokenProblemRef.current === problem) return;
        spokenProblemRef.current = problem;
        setLatestInterviewerPrompt("");
        let cancelled = false;
        (async () => {
            if (supportsSTT) await startHandsFree?.(target);
            if (cancelled) return;
            if (supportsTTS) await speakInterviewer(problem, { remember: false });
            else if (supportsSTT) await resumeHandsFree?.(target);
        })();
        return () => { cancelled = true; };
    }, [problem, resumeHandsFree, speakInterviewer, startHandsFree, supportsSTT, supportsTTS, target]);

    useEffect(() => {
        if (!problem || aiSpeaking || ending || !supportsSTT || !micSessionActive || !handsFreePaused) return;
        resumeHandsFree?.(target);
    }, [aiSpeaking, ending, handsFreePaused, micSessionActive, problem, resumeHandsFree, supportsSTT, target]);

    const status = useMemo(() => {
        if (ending) return { label: "Wrapping up…", color: "info" };
        if (aiSpeaking) return { label: "Interviewer speaking", color: "primary" };
        if (isListening) return { label: "Listening", color: "success" };
        if (micSessionActive) return { label: "Mic ready", color: "success" };
        if (micPermission === "denied") return { label: "Mic blocked", color: "warning" };
        return { label: "Connecting mic…", color: "default" };
    }, [aiSpeaking, ending, isListening, micPermission, micSessionActive]);

    const endDiscussion = async () => {
        await pauseHandsFree?.();
        const result = await onEnd?.();
        if (result === false) await resumeHandsFree?.(target);
        else stopHandsFree?.();
    };

    return (
        <Stack spacing={2}>
            <Paper
                elevation={0}
                sx={{
                    position: "relative",
                    overflow: "hidden",
                    borderRadius: 3,
                    border: "1px solid rgba(148,163,184,.24)",
                    background: "linear-gradient(145deg, #07111f 0%, #0f1f34 62%, #0b1727 100%)",
                    color: "white",
                    px: { xs: 2, md: 3 },
                    py: { xs: 2.25, md: 2.75 },
                }}
            >
                <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2} alignItems={{ md: "center" }}>
                    <Box sx={{ minWidth: 0, maxWidth: 900 }}>
                        <Stack direction="row" spacing={1} alignItems="center" mb={1} flexWrap="wrap" useFlexGap>
                            <RecordVoiceOverRoundedIcon sx={{ color: "#93c5fd" }} />
                            <Typography variant="overline" sx={{ color: "rgba(255,255,255,.68)", fontWeight: 850, letterSpacing: .8 }}>
                                Live system design discussion
                            </Typography>
                            <Chip size="small" color={status.color} label={status.label} />
                        </Stack>
                        <Typography variant="caption" sx={{ color: "#93c5fd", fontWeight: 850, letterSpacing: .5 }}>
                            ORIGINAL PROBLEM
                        </Typography>
                        <Typography sx={{ fontSize: { xs: "1.05rem", md: "1.3rem" }, lineHeight: 1.55, fontWeight: 700 }}>
                            {problem}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,.62)", mt: 1 }}>
                            Talk through your thinking while you draw. If you pause for 15 seconds, the interviewer will step in naturally.
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                        {supportsTTS && problem && (
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<VolumeUpRoundedIcon />}
                                onClick={() => speakInterviewer(problem, { remember: false })}
                                sx={{ color: "white", borderColor: "rgba(255,255,255,.28)", "&:hover": { borderColor: "rgba(255,255,255,.55)" } }}
                            >
                                Replay problem
                            </Button>
                        )}
                        {!micSessionActive && supportsSTT && (
                            <Button size="small" variant="contained" onClick={() => startHandsFree?.(target)}>
                                Enable microphone
                            </Button>
                        )}
                    </Stack>
                </Stack>
                {cameraSlot && <Box sx={{ position: "absolute", right: 12, bottom: 12 }}>{cameraSlot}</Box>}
            </Paper>

            {latestInterviewerPrompt && (
                <Paper variant="outlined" sx={{ px: 2, py: 1.5, borderRadius: 2.5, borderColor: "primary.main", bgcolor: "action.hover" }}>
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1} alignItems={{ sm: "center" }}>
                        <Box>
                            <Typography variant="caption" color="primary.main" fontWeight={850}>INTERVIEWER</Typography>
                            <Typography fontWeight={750}>{latestInterviewerPrompt}</Typography>
                        </Box>
                        {supportsTTS && (
                            <Button size="small" onClick={() => speakInterviewer(latestInterviewerPrompt)} startIcon={<VolumeUpRoundedIcon />}>
                                Replay
                            </Button>
                        )}
                    </Stack>
                </Paper>
            )}

            {micPermission === "denied" && (
                <Alert severity="warning">
                    Microphone access is blocked. Allow microphone permission in your browser to get the intended live interview experience; you can type a transcript as a fallback.
                </Alert>
            )}

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 320px" }, gap: 2, alignItems: "start" }}>
                <Paper variant="outlined" sx={{ p: { xs: 1.25, md: 1.75 }, borderRadius: 3, minWidth: 0 }}>
                    <Suspense fallback={<Skeleton variant="rounded" height={620} />}>
                        <SystemDesignCanvas
                            value={diagramData || ""}
                            onChange={onDiagramChange}
                            label="Architecture whiteboard"
                        />
                    </Suspense>
                </Paper>

                <Stack spacing={1.5} sx={{ position: { lg: "sticky" }, top: { lg: 92 } }}>
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                            <Box>
                                <Typography fontWeight={850}>Conversation</Typography>
                                <Typography variant="caption" color="text.secondary">No push-to-talk. Keep explaining naturally.</Typography>
                            </Box>
                            <Box sx={{ width: 42, height: 42, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: isListening ? "success.light" : "action.hover" }}>
                                <GraphicEqRoundedIcon color={isListening ? "success" : "disabled"} sx={{ transform: `scale(${1 + Math.min(.25, micLevel * .35)})` }} />
                            </Box>
                        </Stack>
                        {interimText && isListening && (
                            <Typography variant="body2" color="text.secondary" fontStyle="italic" mt={1.25}>
                                “{interimText}”
                            </Typography>
                        )}
                        <Divider sx={{ my: 1.5 }} />
                        <Typography variant="caption" color="text.secondary" fontWeight={800}>LIVE TRANSCRIPT</Typography>
                        <Box sx={{ mt: .75, maxHeight: 210, overflow: "auto" }}>
                            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                                {transcript?.trim() || "Your explanation will appear here as you speak."}
                            </Typography>
                        </Box>
                        <Button size="small" sx={{ mt: 1 }} onClick={() => setShowTranscriptEditor((value) => !value)}>
                            {showTranscriptEditor ? "Hide transcript editor" : "Correct transcript"}
                        </Button>
                        {showTranscriptEditor && (
                            <TextField
                                fullWidth
                                multiline
                                minRows={4}
                                value={transcript || ""}
                                onChange={(event) => onTranscriptChange?.(event.target.value)}
                                sx={{ mt: 1 }}
                                label="Transcript"
                            />
                        )}
                        {savedLabel && <Typography variant="caption" color="text.secondary" display="block" mt={1}>{savedLabel}</Typography>}
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                        <Typography fontWeight={850}>Interviewer thread</Typography>
                        <Typography variant="caption" color="text.secondary">
                            Questions, constraints and challenges from the live interviewer appear here.
                        </Typography>
                        <Stack spacing={1.25} mt={1.5} sx={{ maxHeight: 300, overflow: "auto" }}>
                            {interjections.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">Start discussing your design. The interviewer will participate and will step in after 15 seconds of silence.</Typography>
                            ) : interjections.map((item) => (
                                <Box key={item.id} sx={{ pl: 1.25, borderLeft: "3px solid", borderColor: "primary.main" }}>
                                    <Typography variant="caption" color="primary.main" fontWeight={800}>{KIND_LABELS[item.kind] || "Interviewer"}</Typography>
                                    <Typography variant="body2" fontWeight={650}>{item.text}</Typography>
                                </Box>
                            ))}
                            <Box ref={threadEndRef} />
                        </Stack>
                    </Paper>
                </Stack>
            </Box>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1.5}>
                    <Box>
                        <Typography fontWeight={800}>Finished with the design?</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {canEndDiscussion
                                ? "You can end the discussion whenever you feel you have covered the design and its key trade-offs."
                                : `End discussion unlocks after you have explained a little more (${discussionWords}/${MIN_END_DISCUSSION_WORDS} words). This only prevents accidental early endings.`}
                        </Typography>
                    </Box>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={ending ? <CircularProgress size={17} color="inherit" /> : <StopCircleRoundedIcon />}
                        disabled={ending || !canEndDiscussion}
                        onClick={endDiscussion}
                        sx={{ minWidth: 180 }}
                    >
                        {ending ? "Ending discussion…" : "End discussion"}
                    </Button>
                </Stack>
            </Paper>
        </Stack>
    );
}
