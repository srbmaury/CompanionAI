import dotenv from "dotenv";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Ensure .env is loaded regardless of import order
dotenv.config();

// Note: Clients are initialized lazily inside generateJSON so env is already loaded

// Simple timeout helper to bound external API latency
const withTimeout = (promise, ms, label = "operation") => {
    const timeoutMs = Math.max(Number(ms) || 0, 0);
    if (timeoutMs === 0) return promise;
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    return Promise.race([
        promise.finally(() => {
            if (timer) clearTimeout(timer);
        }),
        timeout,
    ]);
};

// Best-effort: normalize model output to raw JSON string (array/object) without code fences
const coerceToRawJSON = (input) => {
    const raw = (input || "").toString().trim();
    if (!raw) return "";
    // Strip Markdown code fences
    const fenced = raw.replace(/^```(?:json)?\n([\s\S]*?)\n```$/i, "$1").trim();
    // If it's already valid JSON, return
    try {
        JSON.parse(fenced);
        return fenced;
    } catch (_) {}
    // Extract first bracketed JSON array/object
    const firstArrayStart = fenced.indexOf("[");
    const firstObjectStart = fenced.indexOf("{");
    const start = [firstArrayStart, firstObjectStart]
        .filter((i) => i !== -1)
        .sort((a, b) => a - b)[0];
    if (start === undefined) return "";
    const endArray = fenced.lastIndexOf("]");
    const endObject = fenced.lastIndexOf("}");
    const end = Math.max(endArray, endObject);
    if (end > start) {
        const slice = fenced.slice(start, end + 1).trim();
        try {
            JSON.parse(slice);
            return slice;
        } catch (_) {}
    }
    return "";
};

// Generate a JSON string response from a prompt using OpenAI first, else Gemini
export const generateJSON = async (prompt) => {
    const trimmed = (prompt || "").toString().slice(0, 16000);
    const aiTimeoutMs = Math.min(
        Math.max(parseInt(process.env.AI_REQUEST_TIMEOUT_MS || "20000", 10) || 20000, 2000),
        120000
    );
    // Try OpenAI Chat Completions
    try {
        const openaiApiKey = process.env.OPENAI_API_KEY || "";
        if (!openaiApiKey) {
            console.warn("[AI][OpenAI] Missing OPENAI_API_KEY; request will fail.");
        }
        const openaiClient = new OpenAI({
            apiKey: openaiApiKey,
            // keep retries minimal to reduce compounded latency
            maxRetries: Number(process.env.AI_MAX_RETRIES || 1),
        });
        const model = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
        // Optional: request metadata (kept minimal)
        const completion = await withTimeout(
            openaiClient.chat.completions.create({
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
        // Fallback to Gemini
        try {
            const geminiApiKey = process.env.GEMINI_API_KEY || "";
            if (!geminiApiKey) {
                console.warn("[AI][Gemini] Missing GEMINI_API_KEY; fallback may fail.");
            }
            const gemini = new GoogleGenerativeAI(geminiApiKey);
            const modelName = process.env.GEMINI_MODEL_NAME || process.env.MODEL_NAME || "gemini-1.5-flash";
            const model = gemini.getGenerativeModel({
                model: modelName,
                generationConfig: { responseMimeType: "application/json" },
            });
            const result = await withTimeout(
                model.generateContent(trimmed),
                aiTimeoutMs,
                "Gemini request"
            );
            const text = result?.response?.text?.() || "";
            const normalized = coerceToRawJSON(text);
            return normalized || (text || "").toString();
        } catch (fallbackErr) {
            // Last resort: return empty JSON construct so callers can handle
            console.warn("[AI][Gemini] request failed:", fallbackErr?.message || fallbackErr);
            return "";
        }
    }
};

// Preserve utility used by webGrounding: return a fetch implementation
export const getFetch = async () => {
    if (typeof fetch !== "undefined") return fetch;
    const { default: nodeFetch } = await import("node-fetch");
    return nodeFetch;
};
