import {
    Box,
    Card,
    CardContent,
    Checkbox,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import { ChatBubbleOutlineRounded, CodeRounded } from "@mui/icons-material";
import { getDefaultQuestionLimit } from "../utils/roundDefaults";

const RoundsSelector = ({ suggestedRounds, selectedRounds, onToggleRound, onChangeMode, onChangeCount }) => {
    return (
        <Stack spacing={2}>
            {suggestedRounds.map((round, idx) => {
                const selected = selectedRounds.find((r) => r.roundName === round.roundName);
                const isSelected = Boolean(selected);

                return (
                    <Card
                        key={idx}
                        variant="outlined"
                        sx={{
                            border: "1px solid",
                            borderColor: isSelected ? "primary.main" : "divider",
                            bgcolor: isSelected ? "action.selected" : "background.paper",
                            boxShadow: isSelected ? "0 10px 30px rgba(91,80,214,.10)" : "none",
                            transition: "border-color .18s ease, transform .18s ease, box-shadow .18s ease",
                            "&:hover": { borderColor: "primary.light", transform: "translateY(-1px)" },
                        }}
                    >
                        <CardContent>
                            <FormControlLabel
                                sx={{ width: "100%", m: 0, alignItems: "flex-start", ".MuiFormControlLabel-label": { flex: 1 } }}
                                control={
                                    <Checkbox
                                        checked={isSelected}
                                        onChange={() => onToggleRound(round)}
                                    />
                                }
                                label={
                                    <Box sx={{ pt: .25 }}>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                        <Box sx={{ color: "primary.main", display: "flex" }}>{round.deliveryMode === "online-assessment" ? <CodeRounded fontSize="small" /> : <ChatBubbleOutlineRounded fontSize="small" />}</Box>
                                        <Typography variant="h6" fontWeight={750}>
                                            {round.roundName}
                                        </Typography>
                                        </Stack>
                                        <Typography variant="body2" color="text.secondary" mt={.75} lineHeight={1.6}>
                                            {round.description}
                                        </Typography>
                                    </Box>
                                }
                            />

                            {isSelected && (
                                <Stack mt={2} spacing={2} direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }}>
                                    <FormControl size="small" sx={{ minWidth: 220 }}>
                                        <InputLabel id={`mode-label-${idx}`}>Delivery Mode</InputLabel>
                                        <Select
                                            labelId={`mode-label-${idx}`}
                                            label="Delivery Mode"
                                            value={selected?.deliveryMode || "conversational"}
                                            onChange={(e) => onChangeMode(round.roundName, e.target.value)}
                                        >
                                            <MenuItem value="conversational">Conversational (one-by-one)</MenuItem>
                                            <MenuItem value="online-assessment">Online Assessment (all at once)</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <Tooltip title="Recommended for this round; adjust from 1–20">
                                        <TextField
                                            size="small"
                                            label="Questions"
                                            type="number"
                                            value={selected?.questionLimit ?? getDefaultQuestionLimit(selected || round)}
                                            onChange={(e) => {
                                                const n = Math.max(1, Math.min(20, Number(e.target.value) || 1));
                                                onChangeCount?.(round.roundName, n);
                                            }}
                                            inputProps={{ min: 1, max: 20 }}
                                            sx={{ width: 120 }}
                                        />
                                    </Tooltip>
                                </Stack>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </Stack>
    );
};

export default RoundsSelector;
