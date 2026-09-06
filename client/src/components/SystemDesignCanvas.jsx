import { useEffect, useMemo, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import FullscreenRoundedIcon from "@mui/icons-material/FullscreenRounded";
import FullscreenExitRoundedIcon from "@mui/icons-material/FullscreenExitRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";

const parseScene = (value) => {
    if (!value) return { elements: [], appState: { viewBackgroundColor: "#ffffff" }, files: {} };
    try {
        const scene = typeof value === "string" ? JSON.parse(value) : value;
        return {
            elements: Array.isArray(scene.elements) ? scene.elements : [],
            appState: scene.appState || {},
            files: scene.files || {},
        };
    } catch {
        return { elements: [], appState: { viewBackgroundColor: "#ffffff" }, files: {} };
    }
};

export default function SystemDesignCanvas({ value = "", onChange, readOnly = false, label = "Architecture diagram" }) {
    const scene = useMemo(() => parseScene(value), [value]);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (!expanded) return undefined;
        const onKeyDown = (event) => {
            if (event.key === "Escape") setExpanded(false);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [expanded]);

    useEffect(() => {
        if (!expanded) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = previousOverflow; };
    }, [expanded]);

    return (
        <Box
            sx={expanded ? {
                position: "fixed",
                inset: 0,
                zIndex: 1600,
                bgcolor: "background.paper",
                p: { xs: 1, md: 2 },
                display: "flex",
                flexDirection: "column",
            } : undefined}
        >
            <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "center" }}
                gap={1}
                mb={1.25}
            >
                <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <AccountTreeRoundedIcon color="primary" fontSize="small" />
                        <Typography variant="subtitle1" fontWeight={850}>{label}</Typography>
                        <Chip
                            size="small"
                            variant="outlined"
                            label={readOnly ? "Review mode" : "Design workspace"}
                            color={readOnly ? "default" : "primary"}
                        />
                    </Stack>
                    {!readOnly && (
                        <Typography variant="caption" color="text.secondary">
                            Sketch components and data flow as you would on a whiteboard. Use labels and connect arrows to make your reasoning easy to follow.
                        </Typography>
                    )}
                </Box>
                <Button
                    size="small"
                    variant={expanded ? "contained" : "outlined"}
                    startIcon={expanded ? <FullscreenExitRoundedIcon /> : <FullscreenRoundedIcon />}
                    onClick={() => setExpanded((current) => !current)}
                    sx={{ flexShrink: 0 }}
                >
                    {expanded ? "Exit focus mode" : "Focus canvas"}
                </Button>
            </Stack>

            <Box
                sx={{
                    height: expanded ? "calc(100vh - 92px)" : { xs: 500, md: 660 },
                    minHeight: expanded ? 0 : { xs: 500, md: 660 },
                    flex: expanded ? 1 : undefined,
                    border: "1px solid",
                    borderColor: expanded ? "primary.main" : "divider",
                    borderRadius: expanded ? 2 : 3,
                    overflow: "hidden",
                    bgcolor: "#fff",
                    boxShadow: expanded ? "0 18px 60px rgba(15, 23, 42, 0.18)" : "0 8px 28px rgba(15, 23, 42, 0.06)",
                }}
            >
                <Excalidraw
                    initialData={scene}
                    viewModeEnabled={readOnly}
                    zenModeEnabled={readOnly}
                    UIOptions={{
                        canvasActions: { loadScene: false, saveToActiveFile: false },
                        tools: { image: false },
                    }}
                    onChange={readOnly || !onChange ? undefined : (elements, appState, files) => onChange(JSON.stringify({
                        elements,
                        appState: {
                            viewBackgroundColor: appState.viewBackgroundColor,
                            gridSize: appState.gridSize,
                            gridStep: appState.gridStep,
                            gridModeEnabled: appState.gridModeEnabled,
                        },
                        files,
                    }))}
                />
            </Box>

            {expanded && !readOnly && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, textAlign: "center" }}>
                    Focus mode only enlarges the workspace. Your interview remains active. Press Esc to return.
                </Typography>
            )}
        </Box>
    );
}
