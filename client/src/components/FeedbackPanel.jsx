import { Box, Card, CardContent, Chip, Divider, LinearProgress, Stack, Typography } from "@mui/material";

import { memo, useMemo } from "react";

const ScoreBar = ({ score }) => {
    const normalized = Math.max(0, Math.min(10, Number(score) || 0));
    const pct = (normalized / 10) * 100;
    return (
        <Stack spacing={0.5} sx={{ minWidth: 160 }}>
            <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">Score</Typography>
                <Typography variant="caption" color="text.secondary">{normalized}/10</Typography>
            </Stack>
            <LinearProgress variant="determinate" value={pct} />
        </Stack>
    );
};

const FeedbackItem = memo(({ index, item }) => {
    const qText = item?.question?.text || "";
    const answer = item?.answerGiven || "";
    const feedback = item?.feedback || null;
    const suggestions = Array.isArray(feedback?.suggestions) ? feedback.suggestions : [];

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={1.2}>
                    <Typography variant="subtitle2">Question {index + 1}</Typography>
                    <Typography>{qText}</Typography>

                    {answer && (
                        <Box>
                            <Typography variant="caption" color="text.secondary">Your answer</Typography>
                            <Box
                                sx={{
                                    mt: 0.5,
                                    p: 1,
                                    bgcolor: (theme) => theme.palette.action.hover,
                                    borderRadius: 1,
                                    whiteSpace: "pre-wrap",
                                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                    fontSize: 12,
                                }}
                            >
                                {answer}
                            </Box>
                        </Box>
                    )}

                    {feedback ? (
                        <Stack spacing={1}>
                            <Divider />
                            <Typography variant="subtitle2">Feedback</Typography>
                            <Typography color="text.primary">{feedback.comment || ""}</Typography>
                            <ScoreBar score={feedback.score} />
                            {suggestions.length > 0 && (
                                <Stack direction="row" flexWrap="wrap" gap={1}>
                                    {suggestions.map((s, i) => (
                                        <Chip key={i} label={s} size="small" />
                                    ))}
                                </Stack>
                            )}
                        </Stack>
                    ) : (
                        <Typography variant="body2" color="text.secondary">Feedback not available yet.</Typography>
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
});

const FeedbackPanel = ({ round }) => {
    const items = useMemo(() => (Array.isArray(round?.questions) ? round.questions : []), [round?.questions]);
    const avgScore = useMemo(() => {
        const scores = items.map((it) => Number(it?.feedback?.score)).filter((n) => Number.isFinite(n));
        return scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
    }, [items]);
    const scoreCount = useMemo(() => {
        return items.reduce((acc, it) => acc + (Number.isFinite(Number(it?.feedback?.score)) ? 1 : 0), 0);
    }, [items]);

    return (
        <Stack spacing={2} mt={2}>
            <Card variant="outlined">
                <CardContent>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between">
                        <Stack spacing={0.5}>
                            <Typography variant="subtitle1">Overall feedback</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Based on {scoreCount} answered question{scoreCount === 1 ? "" : "s"} with feedback
                            </Typography>
                        </Stack>
                        <ScoreBar score={avgScore} />
                    </Stack>
                </CardContent>
            </Card>

            <Stack spacing={2}>
                {items.map((it, idx) => (
                    <FeedbackItem key={idx} index={idx} item={it} />
                ))}
            </Stack>
        </Stack>
    );
};

export default memo(FeedbackPanel);
