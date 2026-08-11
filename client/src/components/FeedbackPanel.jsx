import { Alert, Box, Button, Card, CardContent, Chip, Divider, LinearProgress, Stack, TextField, Typography } from "@mui/material";

import { memo, useEffect, useMemo, useState } from "react";
import { trackEvent } from "../utils/analytics";

const getScore = (item) => {
    const rawScore = item?.feedback?.score;
    if (rawScore === null || rawScore === undefined || rawScore === "") return null;
    const score = Number(rawScore);
    return Number.isFinite(score) ? score : null;
};

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

                    {item?.followUpQuestion && item?.followUpAnswer && (
                        <Box>
                            <Typography variant="caption" color="text.secondary">Follow-up</Typography>
                            <Typography variant="body2" fontWeight={700}>{item.followUpQuestion}</Typography>
                            <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>{item.followUpAnswer}</Typography>
                        </Box>
                    )}

                    {feedback ? (
                        <Stack spacing={1}>
                            <Divider />
                            <Typography variant="subtitle2">Feedback</Typography>
                            <Typography color="text.primary">{feedback.comment || ""}</Typography>
                            <ScoreBar score={feedback.score} />
                            {suggestions.length > 0 && (
                                <Stack spacing={0.5}>
                                    <Typography variant="caption" color="text.secondary">Suggestions</Typography>
                                    <Stack direction="row" flexWrap="wrap" gap={1}>
                                        {suggestions.map((s, i) => (
                                            <Chip key={i} label={s} size="small" />
                                        ))}
                                    </Stack>
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
    const [retryItem, setRetryItem] = useState(null);
    const [retryAnswer, setRetryAnswer] = useState("");
    const items = useMemo(() => (Array.isArray(round?.questions) ? round.questions : []), [round?.questions]);
    const scoredItems = useMemo(() => items
        .map((item, index) => ({ item, index, score: getScore(item) }))
        .filter(({ score }) => score !== null)
        .sort((a, b) => b.score - a.score), [items]);
    const strongest = scoredItems[0] || null;
    const weakest = scoredItems.length > 1 ? scoredItems[scoredItems.length - 1] : scoredItems[0] || null;
    const topSuggestions = useMemo(() => {
        const seen = new Set();
        const result = [];
        [...scoredItems].reverse().forEach(({ item }) => {
            (Array.isArray(item?.feedback?.suggestions) ? item.feedback.suggestions : []).forEach((suggestion) => {
                const value = String(suggestion || "").trim();
                const key = value.toLocaleLowerCase();
                if (value && !seen.has(key) && result.length < 3) {
                    seen.add(key);
                    result.push(value);
                }
            });
        });
        return result;
    }, [scoredItems]);
    const avgScore = useMemo(() => {
        const scores = items.map(getScore).filter((score) => score !== null);
        return scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
    }, [items]);
    const scoreCount = useMemo(() => {
        return items.reduce((acc, item) => acc + (getScore(item) !== null ? 1 : 0), 0);
    }, [items]);

    useEffect(() => {
        setRetryItem(null);
        setRetryAnswer("");
        if (round?._id) trackEvent("feedback_viewed");
    }, [round?._id]);

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
                        {avgScore !== null ? <ScoreBar score={avgScore} /> : (
                            <Typography variant="body2" color="text.secondary">Feedback pending</Typography>
                        )}
                    </Stack>
                    {strongest && (
                        <Stack spacing={2} sx={{ mt: 2 }}>
                            <Divider />
                            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="overline" color="success.main">Strongest answer · {strongest.score}/10</Typography>
                                    <Typography variant="body2">{strongest.item?.question?.text || `Question ${strongest.index + 1}`}</Typography>
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="overline" color="warning.main">Focus next · {weakest.score}/10</Typography>
                                    <Typography variant="body2">{weakest.item?.question?.text || `Question ${weakest.index + 1}`}</Typography>
                                </Box>
                            </Stack>
                            {topSuggestions.length > 0 && (
                                <Box>
                                    <Typography variant="subtitle2" gutterBottom>Top improvements</Typography>
                                    <Stack component="ol" spacing={0.5} sx={{ my: 0, pl: 2.5 }}>
                                        {topSuggestions.map((suggestion) => (
                                            <Typography component="li" variant="body2" key={suggestion}>{suggestion}</Typography>
                                        ))}
                                    </Stack>
                                </Box>
                            )}
                            <Box>
                                <Typography variant="subtitle2">Improved-answer guidance</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Re-answer the focus question and use the improvements above as a checklist. Keep the response direct, support it with a specific example, and end with the result or takeaway.
                                </Typography>
                            </Box>
                            <Box>
                                <Button
                                    variant="contained"
                                    onClick={() => { trackEvent("retry_started"); setRetryItem(weakest); setRetryAnswer(""); }}
                                >
                                    Retry weak question
                                </Button>
                            </Box>
                        </Stack>
                    )}
                </CardContent>
            </Card>

            {retryItem && (
                <Card variant="outlined" sx={{ borderColor: "primary.main" }}>
                    <CardContent>
                        <Stack spacing={1.5}>
                            <Box>
                                <Typography variant="overline" color="primary">Private retry</Typography>
                                <Typography variant="h6">{retryItem.item?.question?.text || `Question ${retryItem.index + 1}`}</Typography>
                            </Box>
                            {Array.isArray(retryItem.item?.feedback?.suggestions) && retryItem.item.feedback.suggestions.length > 0 && (
                                <Alert severity="info">
                                    Before answering: {retryItem.item.feedback.suggestions.join(" · ")}
                                </Alert>
                            )}
                            <TextField
                                label="Try a stronger answer"
                                multiline
                                minRows={5}
                                value={retryAnswer}
                                onChange={(event) => setRetryAnswer(event.target.value)}
                                helperText="This draft stays in this page and does not replace your submitted answer."
                                fullWidth
                            />
                            <Stack direction="row" spacing={1}>
                                <Button variant="outlined" onClick={() => setRetryAnswer("")} disabled={!retryAnswer}>Clear draft</Button>
                                <Button onClick={() => { setRetryItem(null); setRetryAnswer(""); }}>Close retry</Button>
                            </Stack>
                        </Stack>
                    </CardContent>
                </Card>
            )}

            <Stack spacing={2}>
                {items.map((it, idx) => (
                    <FeedbackItem key={idx} index={idx} item={it} />
                ))}
            </Stack>
        </Stack>
    );
};

export default memo(FeedbackPanel);
