import { Card, CardActionArea, CardContent, LinearProgress, Stack, Tooltip, Typography } from "@mui/material";
import { memo } from "react";

const RoundList = ({ interview, selectedRoundId, onSelect, showOnMobile = false }) => {
    if (!interview) return null;
    return (
        <Stack spacing={2} sx={{ display: { xs: showOnMobile ? "flex" : "none", md: "flex" } }}>
            {interview.rounds.map(({ round }) => {
                const idx = interview.rounds.findIndex((r) => r.round._id === round._id);
                const locked = idx > 0 && interview.rounds.slice(0, idx).some((r) => r.round.status !== "completed");
                const total = Math.max(0, Number(round?.questions?.length) || 0);
                const answered = Math.max(0, (round?.questions || []).reduce((acc, q) => acc + (q?.answerGiven ? 1 : 0), 0));
                const pct = total > 0 ? Math.round((answered / total) * 100) : (round?.status === 'completed' ? 100 : 0);
                return (
                    <Card
                        key={round._id}
                        variant="outlined"
                        sx={{
                            border: selectedRoundId === round._id ? "2px solid blue" : "1px solid grey",
                            opacity: locked ? 0.6 : 1,
                        }}
                    >
                        <CardActionArea disabled={locked} onClick={() => !locked && onSelect?.(round)}>
                        <CardContent>
                            <Stack spacing={0.5}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Typography variant="subtitle1">{round.name}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {round.status === 'completed' ? 'Completed' : `${answered}/${total}`}
                                    </Typography>
                                </Stack>
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
