import dotenv from "dotenv";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

// Module-level singletons — created once, reused across all requests
let _openaiClient = null;
let _geminiClient = null;
let _geminiModel = null;

const getOpenAIClient = () => {
    if (!_openaiClient) {
        _openaiClient = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || "",
            maxRetries: Number(process.env.AI_MAX_RETRIES || 1),
        });
    }
    return _openaiClient;
};

const getGeminiModel = () => {
    if (!_geminiModel) {
        _geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
        const modelName = process.env.GEMINI_MODEL_NAME || "gemini-1.5-flash";
        _geminiModel = _geminiClient.getGenerativeModel({
            model: modelName,
            generationConfig: { responseMimeType: "application/json" },
        });
    }
    return _geminiModel;
};

const withTimeout = (promise, ms, label = "operation") => {
    const timeoutMs = Math.max(Number(ms) || 0, 0);
    if (timeoutMs === 0) return promise;
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    return Promise.race([
        promise.finally(() => { if (timer) clearTimeout(timer); }),
        timeout,
    ]);
};

const coerceToRawJSON = (input) => {
    const raw = (input || "").toString().trim();
    if (!raw) return "";
    const fenced = raw.replace(/^```(?:json)?\n([\s\S]*?)\n```$/i, "$1").trim();
    try { JSON.parse(fenced); return fenced; } catch (_) {}
    const firstArrayStart = fenced.indexOf("[");
    const firstObjectStart = fenced.indexOf("{");
    const start = [firstArrayStart, firstObjectStart].filter((i) => i !== -1).sort((a, b) => a - b)[0];
    if (start === undefined) return "";
    const end = Math.max(fenced.lastIndexOf("]"), fenced.lastIndexOf("}"));
    if (end > start) {
        const slice = fenced.slice(start, end + 1).trim();
        try { JSON.parse(slice); return slice; } catch (_) {}
    }
    return "";
};

export const generateJSON = async (prompt) => {
    const trimmed = (prompt || "").toString().slice(0, 16000);
    const aiTimeoutMs = Math.min(
        Math.max(parseInt(process.env.AI_REQUEST_TIMEOUT_MS || "20000", 10) || 20000, 2000),
        120000
    );

    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY not set");
        }
        const model = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
        const completion = await withTimeout(
            getOpenAIClient().chat.completions.create({
                model,
                messages: [
                    { role: "system", content: "Return ONLY raw JSON. No code fences." },
                    { role: "user", content: trimmed },
                ],
                temperature: 0.2,
            }),
            aiTimeoutMs,
            "OpenAI request"
        );
        const text = completion?.choices?.[0]?.message?.content || "";
        const normalized = coerceToRawJSON(text);
        if (normalized) return normalized;
        if (text && text.trim()) return text.trim();
        throw new Error("Empty OpenAI response");
    } catch (_e) {
        console.warn("[AI][OpenAI] request failed:", _e?.message || _e);
        try {
            if (!process.env.GEMINI_API_KEY) {
                throw new Error("GEMINI_API_KEY not set");
            }
            const result = await withTimeout(
                getGeminiModel().generateContent(trimmed),
                aiTimeoutMs,
                "Gemini request"
            );
            const text = result?.response?.text?.() || "";
            const normalized = coerceToRawJSON(text);
            return normalized || (text || "").toString();
        } catch (fallbackErr) {
            console.warn("[AI][Gemini] request failed:", fallbackErr?.message || fallbackErr);
            return "";
        }
    }
};

export const getFetch = async () => {
    if (typeof fetch !== "undefined") return fetch;
    const { default: nodeFetch } = await import("node-fetch");
    return nodeFetch;
};
