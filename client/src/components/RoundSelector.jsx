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
    Typography,
} from "@mui/material";

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
                            border: isSelected ? "2px solid blue" : "1px solid grey",
                        }}
                    >
                        <CardContent>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={isSelected}
                                        onChange={() => onToggleRound(round)}
                                    />
                                }
                                label={
                                    <Box>
                                        <Typography variant="h6">
                                            {round.roundName}
                                        </Typography>
                                        <Typography variant="body2">
                                            {round.description}
                                        </Typography>
                                    </Box>
                                }
                            />

                            {isSelected && (
                                <Stack mt={2} spacing={2} direction={{ xs: "column", sm: "row" }}>
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
