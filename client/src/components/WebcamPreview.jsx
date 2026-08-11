import { useEffect, useRef, useState, memo } from "react";
import { Box, Tooltip, Typography } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";

const WebcamPreview = ({ autoStart = false }) => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [on, setOn] = useState(false);
    const [denied, setDenied] = useState(false);

    const start = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: 320, height: 240 },
                audio: false,
            });
            streamRef.current = stream;
            setOn(true);      // triggers re-render → <video> mounts
            setDenied(false);
        } catch {
            setDenied(true);
        }
    };

    // Attach stream after <video> element is in the DOM
    useEffect(() => {
        if (on && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [on]);

    const stop = (e) => {
        e?.stopPropagation();
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setOn(false);
    };

    useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);
    useEffect(() => { if (autoStart) start(); }, [autoStart]);

    return (
        <Tooltip title={on ? "Click ✕ to turn off camera" : denied ? "Camera access denied" : "Click to turn on camera"} placement="left">
            <Box
                onClick={on ? undefined : start}
                sx={{
                    position: "absolute",
                    bottom: 12,
                    right: 12,
                    width: 128,
                    height: 96,
                    borderRadius: 2,
                    overflow: "hidden",
                    bgcolor: "#111827",
                    border: "2px solid rgba(255,255,255,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    gap: 0.5,
                    cursor: on ? "default" : "pointer",
                    transition: "border-color 0.2s",
                    "&:hover": { borderColor: on ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.35)" },
                }}
            >
                {on ? (
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
                    />
                ) : (
                    <>
                        <PersonIcon sx={{ color: denied ? "error.light" : "rgba(255,255,255,0.25)", fontSize: 28 }} />
                        <Typography sx={{ color: "rgba(255,255,255,0.35)", fontSize: 9, textAlign: "center", px: 1 }}>
                            {denied ? "Cam denied" : "Click for camera"}
                        </Typography>
                    </>
                )}

                {/* Label bar */}
                <Box sx={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    px: 0.75,
                    pb: 0.5,
                    pt: 2,
                    background: "linear-gradient(transparent, rgba(0,0,0,0.75))",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}>
                    <Typography sx={{ color: "rgba(255,255,255,0.85)", fontSize: 9 }}>You</Typography>
                    {on && (
                        <Typography
                            onClick={stop}
                            sx={{ color: "rgba(255,255,255,0.5)", fontSize: 9, cursor: "pointer", "&:hover": { color: "white" } }}
                        >
                            ✕
                        </Typography>
                    )}
                </Box>
            </Box>
        </Tooltip>
    );
};

export default memo(WebcamPreview);
