import { FormControl, InputLabel, MenuItem, Select, IconButton, Stack, Tooltip, LinearProgress, Typography } from "@mui/material";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import MicExternalOnIcon from "@mui/icons-material/MicExternalOn";
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
    // New optional UX props
    micPermission, // 'granted' | 'denied' | 'prompt' | 'unknown'
    micLevel, // 0..1 amplitude level when listening
    inputDevices, // [{deviceId,label}]
    selectedDeviceId,
    onChangeDevice,
    pushToTalk, // boolean
}) => {
    const isActive = useMemo(() => listening && listeningTarget === target, [listening, listeningTarget, target]);
    const micDenied = micPermission === "denied";
    const micIndicatorIcon = micDenied ? <ReportGmailerrorredIcon color="error" /> : <MicExternalOnIcon color={micPermission === "granted" ? "primary" : "inherit"} />;

    return (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }} sx={{ minWidth: 0 }} style={{ ...(style || {}) }}>
            {supportsTTS && (
                <Tooltip title="Speak question">
                    <span>
                        <IconButton aria-label="Speak question" onClick={() => onSpeak(speakText || "") }>
                            <VolumeUpIcon />
                        </IconButton>
                    </span>
                </Tooltip>
            )}

            {/* Device selector (optional) */}
            {Array.isArray(inputDevices) && inputDevices.length > 0 && (
                <FormControl size="small" sx={{ width: { xs: "100%", sm: "auto" }, minWidth: { sm: 160 } }}>
                    <InputLabel id={`mic-device-${target}`}>Microphone</InputLabel>
                    <Select
                        labelId={`mic-device-${target}`}
                        label="Microphone"
                        value={selectedDeviceId || "default"}
                        onChange={(e) => onChangeDevice?.(e.target.value)}
                    >
                        <MenuItem value="default">System default</MenuItem>
                        {inputDevices.map((d) => (
                            <MenuItem key={d.deviceId} value={d.deviceId}>{d.label || `Mic (${d.deviceId.slice(0,6)})`}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            )}

            {/* Permission state */}
            <Tooltip title={
                micPermission === "granted" ? "Mic access granted" :
                micPermission === "denied" ? "Mic access denied — check browser settings" :
                micPermission === "prompt" ? "Browser will request mic access" :
                "Mic access status unknown"
            }>
                <span>{micIndicatorIcon}</span>
            </Tooltip>

            {/* Mic controls with push-to-talk support */}
            {!isActive ? (
                <Tooltip title={pushToTalk ? "Hold to talk" : (micDenied ? "Mic denied" : "Start voice") }>
                    <span>
                        <IconButton
                            aria-label={pushToTalk ? "Hold to talk" : "Start voice"}
                            onClick={!pushToTalk ? (() => onStartListening(target)) : undefined}
                            onMouseDown={pushToTalk ? (() => onStartListening(target)) : undefined}
                            onMouseUp={pushToTalk ? onStopListening : undefined}
                            onMouseLeave={pushToTalk ? onStopListening : undefined}
                            onTouchStart={pushToTalk ? (() => onStartListening(target)) : undefined}
                            onTouchEnd={pushToTalk ? onStopListening : undefined}
                            disabled={!supportsSTT || micDenied}
                        >
                            <MicIcon />
                        </IconButton>
                    </span>
                </Tooltip>
            ) : (
                <Tooltip title={pushToTalk ? "Release to stop" : "Stop voice"}>
                    <IconButton aria-label="Stop voice" onClick={onStopListening}>
                        <MicOffIcon />
                    </IconButton>
                </Tooltip>
            )}

            {/* Live mic level meter when active */}
            <Stack direction="row" alignItems="center" spacing={1} sx={{ width: { xs: "100%", sm: "auto" }, minWidth: { sm: 120 }, display: isActive ? "flex" : "none" }}>
                <Typography variant="caption" color="text.secondary">Level</Typography>
                <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, Math.round((micLevel || 0) * 100)))} sx={{ flex: 1, height: 8, borderRadius: 1 }} />
            </Stack>
        </Stack>
    );
};

export default memo(VoiceControls);
