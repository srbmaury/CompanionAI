import { Box, Button, Card, CardContent, Skeleton, Stack, TextField, Typography } from "@mui/material";
import VoiceControls from "./VoiceControls";
import SkipRoundButton from "./SkipRoundButton";
import { lazy, Suspense } from "react";

const CodeEditorField = lazy(() => import("./CodeEditorField"));

const OAForm = ({
    questions,
    answers,
    spokenAnswers,
    codingEnabled,
    onCodingModeChange,
    onSpokenChange,
    onChange,
    onSubmit,
    onSkip,
    submitting,
    supportsTTS,
    supportsSTT,
    listening,
    listeningTarget,
    onSpeak,
    onStartListening,
    onStopListening,
    outlinedInputSx,
}) => {
    return (
        <>
            <Stack spacing={2} mt={2}>
                {questions?.map((q, idx) => (
                    <Card key={idx} variant="outlined">
                        <CardContent>
                            <Typography variant="subtitle1" gutterBottom>
                                Question {idx + 1}:
                            </Typography>
                            <Typography gutterBottom>
                                {q.question?.text || "(question text unavailable)"}
                            </Typography>

                            <Suspense fallback={<Skeleton variant="rectangular" height={140} sx={{ borderRadius: 1 }} />}>
                                <CodeEditorField
                                    value={answers?.[idx] || ""}
                                    onChange={(val) => onChange(idx, val)}
                                    onModeChange={(enabled) => onCodingModeChange(idx, enabled)}
                                    minRows={5}
                                    outlinedInputSx={outlinedInputSx}
                                />
                            </Suspense>

                            {codingEnabled?.[idx] && <TextField
                                label="Spoken explanation"
                                value={spokenAnswers?.[idx] || ""}
                                onChange={(event) => onSpokenChange(idx, event.target.value)}
                                multiline
                                minRows={2}
                                fullWidth
                                sx={{ mt: 1.5 }}
                                helperText="Voice transcription is kept separate from your written or code answer."
                            />}

                            <Box mt={1} sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: { xs: "stretch", md: "center" } }}>
                                <VoiceControls
                                    target={idx}
                                    speakText={q.question?.text}
                                    supportsTTS={supportsTTS}
                                    supportsSTT={supportsSTT}
                                    listening={listening}
                                    listeningTarget={listeningTarget}
                                    onSpeak={onSpeak}
                                    onStartListening={onStartListening}
                                    onStopListening={onStopListening}
                                />
                            </Box>
                        </CardContent>
                    </Card>
                ))}
            </Stack>

            <Stack direction="row" spacing={1} mt={2} alignItems="center">
                <Button
                    variant="contained"
                    onClick={onSubmit}
                    disabled={submitting}
                >
                    {submitting ? "Submitting..." : "Submit Round"}
                </Button>
                <SkipRoundButton onSkip={onSkip} />
            </Stack>

            <Typography variant="caption" color="text.secondary">
                Use Speak to hear a question and Start Voice to dictate. Fill
                all answers, then click Submit Round.
            </Typography>
        </>
    );
};

export default OAForm;
