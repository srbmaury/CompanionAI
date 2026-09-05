import { Box, ButtonBase, LinearProgress, Paper, Stack, Tooltip, Typography } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { memo } from "react";

const RoundList = ({ interview, selectedRoundId, onSelect, showOnMobile = false }) => {
    if (!interview) return null;
    const interviewComplete = interview.rounds.length > 0 && interview.rounds.every(({ round }) => round.status === "completed");

    return (
        <Stack spacing={0.75} sx={{ display: { xs: showOnMobile ? "flex" : "none", md: "flex" } }}>
            <Typography variant="overline" color="text.secondary" fontWeight={800} sx={{ px: 0.5 }}>
                Interview plan
            </Typography>
            {interview.rounds.map(({ round }, index) => {
                const futureLocked = index > 0 && interview.rounds.slice(0, index).some((item) => item.round.status !== "completed");
                const feedbackLocked = round.status === "completed" && !interviewComplete && selectedRoundId !== round._id;
                const disabled = futureLocked || feedbackLocked;
                const adaptive = Boolean(round?.adaptiveState?.enabled);
                const generated = Math.max(0, Number(round?.questions?.length) || 0);
                const answered = Math.max(0, (round?.questions || []).reduce((acc, question) => acc + (question?.answerGiven ? 1 : 0), 0));
                const budget = adaptive ? Math.max(generated, Number(round?.adaptiveState?.maxQuestions) || Number(round?.questionLimit) || generated) : generated;
                const pct = round?.status === "completed" ? 100 : budget > 0 ? Math.round((answered / budget) * 100) : 0;
                const selected = selectedRoundId === round._id;
                const tooltip = futureLocked ? "Complete the previous round first" : feedbackLocked ? "Feedback unlocks after the interview" : "";

                return (
                    <Paper key={round._id} variant="outlined" sx={{ overflow: "hidden", borderRadius: 2.5, borderColor: selected ? "primary.main" : "divider", bgcolor: selected ? "action.selected" : "background.paper", opacity: disabled ? 0.58 : 1, transition: "border-color .18s ease, background-color .18s ease, transform .18s ease", "&:hover": disabled ? undefined : { transform: "translateY(-1px)", borderColor: selected ? "primary.main" : "text.disabled" } }}>
                        <Tooltip title={tooltip} placement="right">
                            <span>
                                <ButtonBase disabled={disabled} onClick={() => !disabled && onSelect?.(round)} sx={{ width: "100%", p: 1.4, display: "block", textAlign: "left" }}>
                                    <Stack direction="row" spacing={1.25} alignItems="flex-start">
                                        <Box sx={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", bgcolor: round.status === "completed" ? "success.main" : selected ? "primary.main" : "action.hover", color: round.status === "completed" || selected ? "primary.contrastText" : "text.secondary", fontWeight: 800, fontSize: ".78rem" }}>
                                            {disabled ? <LockRoundedIcon sx={{ fontSize: 15 }} /> : round.status === "completed" ? <CheckRoundedIcon sx={{ fontSize: 18 }} /> : index + 1}
                                        </Box>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
                                                <Typography variant="body2" fontWeight={selected ? 850 : 700} noWrap>{round.name}</Typography>
                                                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                                                    {feedbackLocked ? "Review later" : round.status === "completed" ? "Done" : answered > 0 ? `${answered} answered` : "Not started"}
                                                </Typography>
                                            </Stack>
                                            <LinearProgress variant="determinate" value={pct} color={round.status === "completed" ? "success" : "primary"} sx={{ mt: 1, height: 4, borderRadius: 999 }} />
                                            {futureLocked && <Typography variant="caption" color="text.secondary" display="block" mt={0.75}>Locked until the previous round ends</Typography>}
                                            {feedbackLocked && <Typography variant="caption" color="text.secondary" display="block" mt={0.75}>Debrief unlocks after all rounds</Typography>}
                                        </Box>
                                    </Stack>
                                </ButtonBase>
                            </span>
                        </Tooltip>
                    </Paper>
                );
            })}
        </Stack>
    );
};

export default memo(RoundList);
