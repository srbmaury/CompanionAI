import { useMemo } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { Box, Typography } from "@mui/material";

const parseScene = (value) => {
    if (!value) return { elements: [], appState: { viewBackgroundColor: "#ffffff" }, files: {} };
    try {
        const scene = typeof value === "string" ? JSON.parse(value) : value;
        return { elements: Array.isArray(scene.elements) ? scene.elements : [], appState: scene.appState || {}, files: scene.files || {} };
    } catch { return { elements: [], appState: { viewBackgroundColor: "#ffffff" }, files: {} }; }
};

export default function SystemDesignCanvas({ value = "", onChange, readOnly = false, label = "Architecture diagram" }) {
    const scene = useMemo(() => parseScene(value), [value]);
    return <Box>
        <Typography variant="subtitle2" fontWeight={800} mb={1}>{label}</Typography>
        <Box sx={{ height: { xs: 430, md: 560 }, border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden", bgcolor: "#fff" }}>
            <Excalidraw
                initialData={scene}
                viewModeEnabled={readOnly}
                zenModeEnabled={readOnly}
                UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false }, tools: { image: false } }}
                onChange={readOnly || !onChange ? undefined : (elements, appState, files) => onChange(JSON.stringify({
                    elements,
                    appState: { viewBackgroundColor: appState.viewBackgroundColor, gridSize: appState.gridSize, gridStep: appState.gridStep, gridModeEnabled: appState.gridModeEnabled },
                    files,
                }))}
            />
        </Box>
    </Box>;
}
