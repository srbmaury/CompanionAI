import { Button, Card, CardContent, CircularProgress, Stack, Typography, TextField, Chip, Divider, Skeleton } from "@mui/material";
import VoiceControls from "./VoiceControls";
import SkipRoundButton from "./SkipRoundButton";
import { lazy, memo, Suspense, useMemo } from "react";

const CodeEditorField = lazy(() => import("../pages/CodeEditorField"));

const ConversationalPanel = ({
    convSubmitting,
    convRoundSubmitting,
    convState,
    convAnswer,
    setConvAnswer,
    onSubmitAnswer,
    onCompleteRound,
    onClarify,
    onSkip,
    supportsTTS,
    supportsSTT,
    listening,
    listeningTarget,
    onSpeak,
    onStartListening,
    onStopListening,
    outlinedInputSx,
    savedAt,
}) => {
    const questionNumber = useMemo(() => (convState?.index ?? 0) + 1, [convState?.index]);
    const questionText = convState?.current?.text;
    const nowLabel = useMemo(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), []);
    const savedLabel = useMemo(() => {
        if (!savedAt) return null;
        const diff = Math.floor((Date.now() - savedAt) / 1000);
        if (diff < 3) return "Saved just now";
        if (diff < 60) return `Saved ${diff}s ago`;
        const m = Math.floor(diff / 60);
        return `Saved ${m}m ago`;
    }, [savedAt]);
    return (
        <Card variant="outlined">
            <CardContent>
                {convSubmitting ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size={20} />
                        <Typography>Submitting answer…</Typography>
                    </Stack>
                ) : convState?.done ? (
                    <Typography>Round completed.</Typography>
                ) : convState?.current ? (
                    <>
                        <Typography variant="subtitle1" gutterBottom>
                            Question {questionNumber}
                        </Typography>
                        <Typography gutterBottom>{questionText}</Typography>

                        {/* Timestamp and typing indicator area */}
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <Chip size="small" label={`Asked at ${nowLabel}`} />
                            {convRoundSubmitting && (
                                <Chip size="small" label="AI is thinking…" color="info" variant="outlined" />
                            )}
                            {savedLabel && (
                                <Chip size="small" label={savedLabel} variant="outlined" />
                            )}
                        </Stack>

                        <Suspense fallback={<Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1, mb: 1 }} />}>
                            <CodeEditorField
                                value={convAnswer}
                                onChange={setConvAnswer}
                                outlinedInputSx={outlinedInputSx}
                            />
                        </Suspense>

                        <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={1}
                            mt={2}
                            alignItems={{ xs: "stretch", md: "center" }}
                        >
                            <VoiceControls
                                target="conv"
                                speakText={questionText}
                                supportsTTS={supportsTTS}
                                supportsSTT={supportsSTT}
                                listening={listening}
                                listeningTarget={listeningTarget}
                                onSpeak={onSpeak}
                                onStartListening={onStartListening}
                                onStopListening={onStopListening}
                            />
                            <Button
                                variant="contained"
                                onClick={() => onSubmitAnswer(convAnswer)}
                                disabled={convSubmitting}
                                size="small"
                                sx={{ width: { xs: "100%", md: "auto" } }}
                            >
                                {convSubmitting
                                    ? "Submitting…"
                                    : "Submit Answer"}
                            </Button>
                            <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ flex: 1 }}>
                                <TextField
                                    size="small"
                                    placeholder="Ask a clarification..."
                                    fullWidth
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            const val = e.currentTarget.value.trim();
                                            if (val && onClarify) onClarify(val);
                                            e.currentTarget.value = "";
                                        }
                                    }}
                                />
                                <Button
                                    variant="outlined"
                                    onClick={(e) => {
                                        const input = e.currentTarget.parentElement.querySelector('input,textarea');
                                        const val = (input?.value || "").trim();
                                        if (val && onClarify) onClarify(val);
                                        if (input) input.value = "";
                                    }}
                                    size="small"
                                    sx={{ width: { xs: "100%", md: "auto" } }}
                                >
                                    Clarify
                                </Button>
                            </Stack>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={onCompleteRound}
                                disabled={convRoundSubmitting}
                                size="small"
                                sx={{ width: { xs: "100%", md: "auto" } }}
                            >
                                {convRoundSubmitting
                                    ? "Submitting…"
                                    : "Submit Round"}
                            </Button>
                            <SkipRoundButton onSkip={onSkip} />
                        </Stack>

                        <Divider sx={{ my: 1.5 }} />
                        <Typography variant="caption" color="text.secondary">
                            Use Speak to hear the question. Talk or type your
                            answer, then click Submit Answer to move to the next
                            question.
                        </Typography>
                    </>
                ) : (
                    <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size={20} />
                        <Typography>Loading next question…</Typography>
                    </Stack>
                )}
            </CardContent>
        </Card>
    );
};

export default memo(ConversationalPanel);
