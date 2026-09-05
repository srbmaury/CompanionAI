import {
    Button,
    Chip,
    FormControl,
    InputLabel,
    LinearProgress,
    MenuItem,
    Select,
    Stack,
    Tooltip,
    Typography,
} from "@mui/material";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import SettingsVoiceRoundedIcon from "@mui/icons-material/SettingsVoiceRounded";
import ReportGmailerrorredIcon from "@mui/icons-material/ReportGmailerrorred";
import { memo, useMemo } from "react";

const VoiceControls = ({
    target,
    speakText,
    supportsTTS,
    supportsSTT,
    listening,
    listeningTarget,
    onSpeak,
    onStartListening,
    onStopListening,
    style,
    micPermission,
    micLevel,
    inputDevices,
    selectedDeviceId,
    onChangeDevice,
    pushToTalk,
    handsFree = false,
    micSessionActive = false,
    handsFreePaused = false,
    onStartHandsFree,
}) => {
    const isActive = useMemo(() => listening && listeningTarget === target, [listening, listeningTarget, target]);
    const micDenied = micPermission === "denied";
    const multipleMicrophones = Array.isArray(inputDevices) && inputDevices.length > 1;

    const startProps = pushToTalk ? {
        onMouseDown: () => onStartListening(target),
        onMouseUp: onStopListening,
        onMouseLeave: onStopListening,
        onTouchStart: () => onStartListening(target),
        onTouchEnd: onStopListening,
    } : {
        onClick: () => onStartListening(target),
    };

    return (
        <Stack spacing={1} sx={{ minWidth: 0 }} style={{ ...(style || {}) }}>
            <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                alignItems={{ xs: "stretch", sm: "center" }}
                flexWrap="wrap"
                useFlexGap
            >
                {supportsTTS && (
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<VolumeUpIcon />}
                        aria-label="Speak question"
                        onClick={() => onSpeak(speakText || "")}
                    >
                        Replay question
                    </Button>
                )}

                {handsFree ? (
                    <>
                        {micSessionActive ? (
                            <Chip
                                size="small"
                                color="success"
                                icon={<MicIcon />}
                                label={isActive ? "Mic live · listening" : handsFreePaused ? "Mic ready · interviewer speaking" : "Mic ready"}
                            />
                        ) : (
                            <Tooltip title={micDenied ? "Microphone access is blocked in your browser" : "The microphone will stay available for the interview"}>
                                <span>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        startIcon={<MicIcon />}
                                        disabled={!supportsSTT || micDenied}
                                        onClick={() => onStartHandsFree?.(target)}
                                    >
                                        Enable microphone
                                    </Button>
                                </span>
                            </Tooltip>
                        )}
                    </>
                ) : !isActive ? (
                    <Tooltip title={pushToTalk ? "Hold while you speak" : micDenied ? "Microphone access is blocked in your browser" : "Transcribe your spoken answer"}>
                        <span>
                            <Button
                                size="small"
                                variant="contained"
                                startIcon={<MicIcon />}
                                aria-label={pushToTalk ? "Hold to talk" : "Start voice"}
                                disabled={!supportsSTT || micDenied}
                                {...startProps}
                            >
                                {pushToTalk ? "Hold to speak" : "Answer with voice"}
                            </Button>
                        </span>
                    </Tooltip>
                ) : (
                    <Button
                        size="small"
                        variant="contained"
                        color="error"
                        startIcon={<MicOffIcon />}
                        aria-label="Stop voice"
                        onClick={onStopListening}
                    >
                        {pushToTalk ? "Release to stop" : "Stop recording"}
                    </Button>
                )}

                {micDenied && (
                    <Chip
                        size="small"
                        color="error"
                        variant="outlined"
                        icon={<ReportGmailerrorredIcon />}
                        label="Microphone blocked"
                    />
                )}

                {!supportsSTT && (
                    <Chip
                        size="small"
                        variant="outlined"
                        label="Voice unavailable · typing still works"
                    />
                )}

                {multipleMicrophones && (
                    <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 170 } }}>
                        <InputLabel id={`mic-device-${target}`}>Microphone</InputLabel>
                        <Select
                            labelId={`mic-device-${target}`}
                            label="Microphone"
                            value={selectedDeviceId || "default"}
                            onChange={(event) => onChangeDevice?.(event.target.value)}
                            startAdornment={<SettingsVoiceRoundedIcon sx={{ mr: 1, color: "text.secondary" }} fontSize="small" />}
                        >
                            <MenuItem value="default">System default</MenuItem>
                            {inputDevices.map((device) => (
                                <MenuItem key={device.deviceId} value={device.deviceId}>
                                    {device.label || `Microphone (${device.deviceId.slice(0, 6)})`}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                )}
            </Stack>

            {(isActive || (handsFree && micSessionActive)) && (
                <Stack direction="row" alignItems="center" spacing={1} sx={{ maxWidth: 360 }}>
                    <Typography variant="caption" color={isActive ? "success.main" : "text.secondary"} fontWeight={700} sx={{ whiteSpace: "nowrap" }}>
                        {isActive ? "Listening" : "Interview mic active"}
                    </Typography>
                    <LinearProgress
                        variant="determinate"
                        value={isActive ? Math.max(5, Math.min(100, Math.round((micLevel || 0) * 100))) : 5}
                        color={isActive ? "success" : "inherit"}
                        sx={{ flex: 1, height: 6, borderRadius: 999 }}
                    />
                </Stack>
            )}
            {handsFree && micSessionActive && (
                <Typography variant="caption" color="text.secondary">
                    No push-to-talk: the microphone stays available and transcription pauses automatically while the interviewer speaks.
                </Typography>
            )}
        </Stack>
    );
};

export default memo(VoiceControls);
