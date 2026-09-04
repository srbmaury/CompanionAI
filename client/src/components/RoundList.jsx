import { Card, CardActionArea, CardContent, Chip, LinearProgress, Stack, Tooltip, Typography } from "@mui/material";
import { memo } from "react";

const RoundList = ({ interview, selectedRoundId, onSelect, showOnMobile = false }) => {
    if (!interview) return null;
    return (
        <Stack spacing={2} sx={{ display: { xs: showOnMobile ? "flex" : "none", md: "flex" } }}>
            {interview.rounds.map(({ round }) => {
                const idx = interview.rounds.findIndex((r) => r.round._id === round._id);
                const locked = idx > 0 && interview.rounds.slice(0, idx).some((r) => r.round.status !== "completed");
                const adaptive = Boolean(round?.adaptiveState?.enabled);
                const generated = Math.max(0, Number(round?.questions?.length) || 0);
                const answered = Math.max(0, (round?.questions || []).reduce((acc, q) => acc + (q?.answerGiven ? 1 : 0), 0));
                const budget = adaptive
                    ? Math.max(generated, Number(round?.adaptiveState?.maxQuestions) || Number(round?.questionLimit) || generated)
                    : generated;
                const pct = round?.status === "completed"
                    ? 100
                    : budget > 0 ? Math.round((answered / budget) * 100) : 0;
                return (
                    <Card
                        key={round._id}
                        variant="outlined"
                        sx={{
                            borderColor: selectedRoundId === round._id ? "primary.main" : "divider",
                            borderWidth: selectedRoundId === round._id ? 2 : 1,
                            opacity: locked ? 0.6 : 1,
                        }}
                    >
                        <CardActionArea disabled={locked} onClick={() => !locked && onSelect?.(round)}>
                        <CardContent>
                            <Stack spacing={0.75}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                                    <Typography variant="subtitle1">{round.name}</Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                                        {round.status === "completed" ? "Completed" : adaptive ? `${answered}/${budget} max` : `${answered}/${generated}`}
                                    </Typography>
                                </Stack>
                                {adaptive && round.status !== "completed" && (
                                    <Chip size="small" label="Adaptive" variant="outlined" sx={{ alignSelf: "flex-start", height: 22 }} />
                                )}
                                <LinearProgress variant="determinate" value={pct} />
                                {locked && (
                                    <Tooltip title="Complete previous round to unlock">
                                        <Typography variant="caption" color="text.secondary">
                                            Locked until previous round is completed
                                        </Typography>
                                    </Tooltip>
                                )}
                            </Stack>
                        </CardContent>
                        </CardActionArea>
                    </Card>
                );
            })}
        </Stack>
    );
};

export default memo(RoundList);
