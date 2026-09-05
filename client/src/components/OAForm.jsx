import { lazy, Suspense, useMemo, useState } from "react";
import {
    Box,
    Button,
    Chip,
    LinearProgress,
    Paper,
    Skeleton,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import VoiceControls from "./VoiceControls";
import SkipRoundButton from "./SkipRoundButton";

const CodeEditorField = lazy(() => import("./CodeEditorField"));

const OAForm = ({
    questions,
    answers,
    spokenAnswers,
    codingEnabled,
    onCodingModeChange,
    codeDraftPrefix,
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
    const [activeIndex, setActiveIndex] = useState(0);
    const total = questions?.length || 0;
    const safeIndex = Math.min(activeIndex, Math.max(total - 1, 0));
    const activeQuestion = questions?.[safeIndex];
    const answeredCount = useMemo(
        () => (questions || []).reduce((count, _question, index) => {
            const written = String(answers?.[index] || "").trim();
            const spoken = String(spokenAnswers?.[index] || "").trim();
            return count + (written || spoken ? 1 : 0);
        }, 0),
        [answers, questions, spokenAnswers],
    );
    const progress = total ? ((safeIndex + 1) / total) * 100 : 0;
    const remaining = Math.max(total - answeredCount, 0);

    if (!total) {
        return (
            <Paper variant="outlined" sx={{ p: 3, mt: 2 }}>
                <Typography color="text.secondary">Preparing assessment questions…</Typography>
            </Paper>
        );
    }

    const goPrevious = () => setActiveIndex((current) => Math.max(0, current - 1));
    const goNext = () => setActiveIndex((current) => Math.min(total - 1, current + 1));

    return (
        <Stack spacing={2.5} mt={2}>
            <Paper
                variant="outlined"
                sx={{
                    overflow: "hidden",
                    borderRadius: 3,
                    boxShadow: "0 12px 36px rgba(15, 23, 42, 0.06)",
                }}
            >
                <Box sx={{ px: { xs: 2, md: 3 }, pt: 2.5, pb: 2, bgcolor: "action.hover" }}>
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1.5} alignItems={{ sm: "center" }}>
                        <Box>
                            <Typography variant="overline" color="primary.main" fontWeight={800}>
                                Online assessment · Question {safeIndex + 1} of {total}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Work on one problem at a time. Your answers stay in place when you move between questions.
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Chip
                                size="small"
                                icon={<CheckCircleRoundedIcon />}
                                label={`${answeredCount}/${total} answered`}
                                color={answeredCount === total ? "success" : "default"}
                                variant="outlined"
                            />
                            <Chip
                                size="small"
                                label={remaining ? `${remaining} remaining` : "Ready to submit"}
                                color={remaining ? "default" : "success"}
                            />
                        </Stack>
                    </Stack>
                    <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{ mt: 2, height: 6, borderRadius: 999 }}
                    />
                </Box>

                <Box sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack spacing={2.5}>
                        <Box>
                            <Typography
                                component="h2"
                                variant="h5"
                                fontWeight={800}
                                sx={{ lineHeight: 1.4, maxWidth: 980 }}
                            >
                                {activeQuestion?.question?.text || "(question text unavailable)"}
                            </Typography>
                            <Box sx={{ mt: 1.5 }}>
                                <VoiceControls
                                    target={safeIndex}
                                    speakText={activeQuestion?.question?.text}
                                    supportsTTS={supportsTTS}
                                    supportsSTT={supportsSTT}
                                    listening={listening}
                                    listeningTarget={listeningTarget}
                                    onSpeak={onSpeak}
                                    onStartListening={onStartListening}
                                    onStopListening={onStopListening}
                                />
                            </Box>
                        </Box>

                        <Suspense fallback={<Skeleton variant="rectangular" height={320} sx={{ borderRadius: 2 }} />}>
                            <CodeEditorField
                                value={answers?.[safeIndex] || ""}
                                onChange={(value) => onChange(safeIndex, value)}
                                onModeChange={(enabled) => onCodingModeChange(safeIndex, enabled)}
                                draftKey={`${codeDraftPrefix}:${safeIndex}`}
                                suggestCode={/\b(code|implement|algorithm|data structure|complexity|function|program)\b/i.test(activeQuestion?.question?.text || "")}
                                minRows={12}
                                outlinedInputSx={outlinedInputSx}
                            />
                        </Suspense>

                        {codingEnabled?.[safeIndex] && (
                            <TextField
                                label="Explain your approach"
                                value={spokenAnswers?.[safeIndex] || ""}
                                onChange={(event) => onSpokenChange(safeIndex, event.target.value)}
                                multiline
                                minRows={3}
                                fullWidth
                                helperText="Optional: explain your reasoning, complexity, assumptions, or trade-offs. Voice transcription appears here."
                            />
                        )}
                    </Stack>
                </Box>

                <Box
                    sx={{
                        px: { xs: 2, md: 3 },
                        py: 2,
                        borderTop: "1px solid",
                        borderColor: "divider",
                        bgcolor: "background.default",
                    }}
                >
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1.5} alignItems={{ md: "center" }}>
                        <Stack direction="row" spacing={1}>
                            <Button
                                startIcon={<ArrowBackRoundedIcon />}
                                onClick={goPrevious}
                                disabled={safeIndex === 0 || submitting}
                            >
                                Previous
                            </Button>
                            {safeIndex < total - 1 && (
                                <Button
                                    variant="outlined"
                                    endIcon={<ArrowForwardRoundedIcon />}
                                    onClick={goNext}
                                    disabled={submitting}
                                >
                                    Next question
                                </Button>
                            )}
                        </Stack>

                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                            <Button
                                variant="contained"
                                onClick={onSubmit}
                                disabled={submitting}
                                sx={{ minWidth: 150 }}
                            >
                                {submitting ? "Submitting…" : "Submit round"}
                            </Button>
                            <SkipRoundButton onSkip={onSkip} />
                        </Stack>
                    </Stack>
                </Box>
            </Paper>

            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", justifyContent: "center" }} aria-label="Question navigation">
                {questions.map((_question, index) => {
                    const answered = Boolean(String(answers?.[index] || "").trim() || String(spokenAnswers?.[index] || "").trim());
                    return (
                        <Button
                            key={index}
                            size="small"
                            variant={index === safeIndex ? "contained" : "outlined"}
                            color={answered && index !== safeIndex ? "success" : "primary"}
                            onClick={() => setActiveIndex(index)}
                            disabled={submitting}
                            aria-label={`Go to question ${index + 1}${answered ? ", answered" : ""}`}
                            sx={{ minWidth: 40, borderRadius: 2 }}
                        >
                            {index + 1}
                        </Button>
                    );
                })}
            </Box>
        </Stack>
    );
};

export default OAForm;
