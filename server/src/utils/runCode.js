import fetch from "node-fetch";
import metrics from "../metrics/index.js";

const getLanguageId = (language) => {
    switch (language) {
        case "javascript":
            return 63; // Judge0 ID for JS
        case "python":
            return 71; // Python 3
        case "cpp":
            return 54; // C++
        case "java":
            return 62; // Java
        default:
            return 63; // Default to JS
    }
};

const runCode = async (req, res) => {
    const { language, code, stdin } = req.body;

    if (!language || !code)
        return res.status(400).json({ error: "Missing language or code" });

    try {
        const timeoutMs = Math.max(parseInt(process.env.JUDGE0_TIMEOUT_MS || "15000", 10) || 15000, 1000);
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
        const response = await fetch(
            process.env.JUDGE0_URL,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-RapidAPI-Key": process.env.JUDGE0_KEY,
                    "X-RapidAPI-Host": process.env.JUDGE0_HOST,
                },
                body: JSON.stringify({
                    language_id: getLanguageId(language),
                    source_code: code,
                    stdin: stdin || "", // send input
                }),
                signal: controller ? controller.signal : undefined,
            }
        );
        if (timer) clearTimeout(timer);

        if (!response.ok) {
            const text = await response.text();
            try { metrics.runCodeTotal.labels(language, "failure", "remote").inc(); } catch {}
            return res
                .status(response.status)
                .json({ error: text || "Judge0 error" });
        }

        const data = await response.json();

        // Normalize fields
        const status = data?.status || {};
        const statusDescription = status?.description || "";
        const stdout = data?.stdout || "";
        const stderr = data?.stderr || "";
        const compileOutputRaw = data?.compile_output || "";
        const message = data?.message || "";

        // Determine error type
        const isCompilationError = /compilation/i.test(statusDescription) || !!compileOutputRaw;
        const isRuntimeError = /runtime/i.test(statusDescription) || (!!stderr && !isCompilationError);
        const isError = isCompilationError || isRuntimeError;
        const errorType = isCompilationError ? "compile" : isRuntimeError ? "runtime" : "none";

        // Prefer the most relevant output
        let preferredOutput = "";
        if (isCompilationError) {
            preferredOutput = compileOutputRaw || stderr || message || stdout || "";
        } else if (isRuntimeError) {
            preferredOutput = stderr || message || stdout || "";
        } else {
            preferredOutput = stdout || message || "";
        }

        try { metrics.runCodeTotal.labels(language, isError ? "failure" : "success", errorType).inc(); } catch {}
        return res.json({
            // Backward-compatible aggregated output
            output: preferredOutput,
            // Structured fields
            stdout,
            stderr,
            compileOutput: compileOutputRaw,
            message,
            status: { id: status?.id, description: statusDescription },
            isError,
            errorType, // 'compile' | 'runtime' | 'none'
            time: data?.time,
            memory: data?.memory,
        });
    } catch (err) {
        try { metrics.runCodeTotal.labels(language || "unknown", "failure", "exception").inc(); } catch {}
        const isAbort = (err && (err.name === "AbortError" || /aborted|timeout/i.test(err.message)));
        res.status(504).json({ error: isAbort ? "Execution timed out" : err.message });
    }
};

export default runCode;
