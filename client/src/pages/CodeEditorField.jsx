import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
    TextField,
    Stack,
    IconButton,
    Button,
    Select,
    MenuItem,
    Typography,
} from "@mui/material";
import CodeIcon from "@mui/icons-material/Code";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import MonacoEditor from "react-monaco-editor";
import api from "../api/axios";

const languages = [
    { label: "JavaScript", value: "javascript" },
    { label: "Python", value: "python" },
    { label: "C++", value: "cpp" },
    { label: "Java", value: "java" },
];

const CodeEditorField = ({ value, onChange, minRows = 6, outlinedInputSx }) => {
    const [useEditor, setUseEditor] = useState(false);
    const [language, setLanguage] = useState("cpp");
    const [stdin, setStdin] = useState("");
    const [isRunning, setIsRunning] = useState(false);
    const [output, setOutput] = useState("");
    const [runError, setRunError] = useState("");
    const [execMeta, setExecMeta] = useState(null); // structured fields from backend
    const editorRef = useRef(null);
    const [editorHeight, setEditorHeight] = useState(300);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const dragStateRef = useRef({ dragging: false, startY: 0, startH: 0 });
    const autoResizeRef = useRef(true);
    const [editorTheme, setEditorTheme] = useState("vs-dark");

    useEffect(() => {
        try {
            const saved = localStorage.getItem("codeEditorTheme");
            if (saved === "vs-light" || saved === "vs-dark") setEditorTheme(saved);
        } catch {
            /* no-op */
        }
    }, []);

    // Initialize language from preferredProgrammingLanguage if present
    useEffect(() => {
        try {
            const preferred = localStorage.getItem("preferredProgrammingLanguage");
            if (preferred && ["javascript", "python", "cpp", "java"].includes(preferred)) {
                setLanguage(preferred);
            }
        } catch { /* ignore */ }
    }, []);

    const handleRunCode = useCallback(async () => {
        if (!useEditor) return;
        setRunError("");
        setOutput("");
        setExecMeta(null);

        if (!value || !String(value).trim()) {
            setRunError("Please enter some code to run.");
            return;
        }

        try {
            setIsRunning(true);
            const response = await api.post("/run-code", {
                language,
                code: value,
                stdin, // send input to backend
            });
            const d = response?.data || {};
            setOutput(d?.output ?? "");
            setExecMeta({
                status: d?.status,
                stdout: d?.stdout,
                stderr: d?.stderr,
                compileOutput: d?.compileOutput,
                message: d?.message,
                isError: d?.isError,
                errorType: d?.errorType,
                time: d?.time,
                memory: d?.memory,
            });
        } catch (err) {
            const message =
                err?.response?.data?.error ||
                err?.message ||
                "Failed to run code";
            setRunError(message);
        } finally {
            setIsRunning(false);
        }
    }, [useEditor, value, language, stdin]);

    const handleEditorDidMount = useCallback((editor, monaco) => {
        editorRef.current = editor;
        const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight) || 18;
        const minimumEditorHeight = (minRows || 6) * lineHeight + 20;
        const maximumEditorHeight = 2000; // allow larger expansion

        const updateEditorHeight = () => {
            if (!editorRef.current) return;
            if (!autoResizeRef.current) return;
            const contentHeight = editorRef.current.getContentHeight();
            const nextHeight = Math.max(contentHeight, minimumEditorHeight);
            const clampedHeight = Math.min(nextHeight, maximumEditorHeight);
            setEditorHeight(clampedHeight);
            editorRef.current.layout();
        };

        editor.onDidContentSizeChange(updateEditorHeight);
        // Shortcuts: Run (Cmd/Ctrl+Enter), Run (F9)
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            handleRunCode();
        });
        editor.addCommand(monaco.KeyCode.F9, () => {
            handleRunCode();
        });
        updateEditorHeight();
    }, [handleRunCode, minRows]);

    return (
        <>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                <Typography variant="body2">
                    {useEditor ? "Code Editor:" : "Answer:"}
                </Typography>
                <IconButton
                    onClick={() => setUseEditor(!useEditor)}
                    size="small"
                >
                    <CodeIcon />
                </IconButton>
                {useEditor && (
                    <IconButton
                        onClick={() => {
                            const next = editorTheme === "vs-dark" ? "vs-light" : "vs-dark";
                            setEditorTheme(next);
                            try { localStorage.setItem("codeEditorTheme", next); } catch { /* no-op */ }
                        }}
                        size="small"
                        title={editorTheme === "vs-dark" ? "Switch to Light" : "Switch to Dark"}
                    >
                        {editorTheme === "vs-dark" ? <Brightness7Icon /> : <Brightness4Icon />}
                    </IconButton>
                )}
                {useEditor && (
                    <Select
                        size="small"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                    >
                        {languages.map((lang) => (
                            <MenuItem key={lang.value} value={lang.value}>
                                {lang.label}
                            </MenuItem>
                        ))}
                    </Select>
                )}
                {useEditor && (
                    <Button
                        size="small"
                        variant="contained"
                        onClick={handleRunCode}
                        disabled={isRunning}
                        startIcon={<PlayArrowIcon />}
                    >
                        {isRunning ? "Running..." : "Run"}
                    </Button>
                )}
                {useEditor && (
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setIsFullscreen((f) => !f)}
                    >
                        {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    </Button>
                )}
            </Stack>

            {useEditor && (
                <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    placeholder="Input for your code (stdin)"
                    value={stdin}
                    onChange={(e) => setStdin(e.target.value)}
                    sx={{ mb: 1 }}
                />
            )}

            {useEditor ? (
                <div
                    style={
                        isFullscreen
                            ? {
                                  position: "fixed",
                                  inset: 0,
                                  zIndex: 1600,
                                  background: "#0b0f12",
                                  padding: 16,
                                  color: "#e0e0e0",
                              }
                            : {}
                    }
                >
                    {isFullscreen && (
                        <div style={{ position: "sticky", top: 8, display: "flex", gap: 8, alignItems: "center", marginBottom: 8, zIndex: 2, background: "rgba(20,22,25,0.9)", padding: 8, borderRadius: 8, border: "1px solid #222" }}>
                            <Button
                                size="small"
                                variant="outlined"
                                color="inherit"
                                onClick={() => setIsFullscreen(false)}
                                sx={{ borderColor: "#777", color: "#e0e0e0" }}
                            >
                                Exit Fullscreen
                            </Button>
                            <Select
                                size="small"
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                MenuProps={{ disablePortal: true, PaperProps: { sx: { bgcolor: "#0f1418", color: "#e0e0e0" } } }}
                                sx={{ bgcolor: "#0f1418", color: "#e0e0e0" }}
                            >
                                {languages.map((lang) => (
                                    <MenuItem key={lang.value} value={lang.value}>
                                        {lang.label}
                                    </MenuItem>
                                ))}
                            </Select>
                            <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                onClick={handleRunCode}
                                disabled={isRunning}
                                startIcon={<PlayArrowIcon />}
                            >
                                {isRunning ? "Running..." : "Run"}
                            </Button>
                        </div>
                    )}
                    <MonacoEditor
                        width="100%"
                        height={isFullscreen ? "60vh" : editorHeight}
                        language={language}
                        theme={editorTheme}
                        value={value}
                        options={{
                            automaticLayout: true,
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            scrollbar: { vertical: "hidden" },
                            wordWrap: "on",
                            smoothScrolling: true,
                            tabSize: 4,
                            insertSpaces: true,
                            autoClosingBrackets: "always",
                            autoIndent: "full",
                        }}
                        onChange={onChange}
                        editorDidMount={handleEditorDidMount}
                    />
                    {isFullscreen && (output || runError || execMeta) && (
                        <div style={{ marginTop: 12 }}>
                            <Typography variant="caption" color="textSecondary" sx={{ display: "block", mb: 0.5 }}>
                                {execMeta?.isError
                                    ? execMeta?.errorType === "compile"
                                        ? "Compilation Error"
                                        : "Runtime/Error"
                                    : "Output"}
                            </Typography>
                            <TextField
                                value={
                                    execMeta?.isError
                                        ? execMeta?.errorType === "compile"
                                            ? execMeta?.compileOutput || output || runError
                                            : execMeta?.stderr || output || runError
                                        : output
                                }
                                multiline
                                minRows={6}
                                maxRows={12}
                                InputProps={{ readOnly: true }}
                                sx={{
                                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                    width: "100%",
                                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#333' },
                                    '& .MuiInputBase-inputMultiline': { color: '#e0e0e0' },
                                    background: '#0f1418',
                                }}
                            />
                        </div>
                    )}
                    {!isFullscreen && (
                        <div
                            style={{
                                width: "100%",
                                height: 8,
                                cursor: "ns-resize",
                                background: "transparent",
                            }}
                            onMouseDown={(e) => {
                                autoResizeRef.current = false;
                                dragStateRef.current = {
                                    dragging: true,
                                    startY: e.clientY,
                                    startH: editorHeight,
                                };
                                const onMove = (ev) => {
                                    if (!dragStateRef.current.dragging) return;
                                    const delta = ev.clientY - dragStateRef.current.startY;
                                    const next = Math.max(120, dragStateRef.current.startH + delta);
                                    setEditorHeight(next);
                                    if (editorRef.current) {
                                        editorRef.current.layout();
                                    }
                                };
                                const onUp = () => {
                                    dragStateRef.current.dragging = false;
                                    window.removeEventListener("mousemove", onMove);
                                    window.removeEventListener("mouseup", onUp);
                                };
                                window.addEventListener("mousemove", onMove);
                                window.addEventListener("mouseup", onUp);
                            }}
                            onDoubleClick={() => { autoResizeRef.current = true; if (editorRef.current) editorRef.current.layout(); }}
                            title="Drag to resize"
                        />
                    )}
                </div>
            ) : (
                <TextField
                    fullWidth
                    multiline
                    minRows={minRows}
                    placeholder="Answer by typing or speaking..."
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    variant="outlined"
                    sx={outlinedInputSx}
                />
            )}

            {useEditor && !isFullscreen && (output || runError || execMeta) && (
                <Stack mt={1} spacing={0.5}>
                    {execMeta?.isError ? (
                        <>
                            <Typography variant="caption" color="error">
                                {execMeta?.errorType === "compile"
                                    ? "Compilation Error"
                                    : "Runtime/Error"}
                            </Typography>
                            <TextField
                                value={
                                    execMeta?.errorType === "compile"
                                        ? execMeta?.compileOutput || output || runError
                                        : execMeta?.stderr || output || runError
                                }
                                multiline
                                minRows={3}
                                maxRows={10}
                                InputProps={{ readOnly: true }}
                                sx={{
                                    fontFamily:
                                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                                }}
                            />
                        </>
                    ) : (
                        <>
                            <Typography variant="caption" color="textSecondary">
                                Output
                            </Typography>
                            <TextField
                                value={output}
                                multiline
                                minRows={3}
                                maxRows={10}
                                InputProps={{ readOnly: true }}
                                sx={{
                                    fontFamily:
                                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                                }}
                            />
                        </>
                    )}
                    <Typography variant="caption" color="text.secondary">
                        Shortcuts: Run (Cmd/Ctrl+Enter or F9), Fullscreen. Language: C++ by default.
                    </Typography>
                </Stack>
            )}
        </>
    );
};

export default memo(CodeEditorField);
