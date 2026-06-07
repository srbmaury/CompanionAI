import { generateJSON } from "./generateQuestions/aiClient.js";

// Fallback rounds if generation fails
const DEFAULT_ROUNDS = [
    { roundName: "HR Screening", description: "Initial discussion" },
    {
        roundName: "Technical Interview",
        description: "Evaluate technical skills",
    },
    { roundName: "Manager Round", description: "Team and role fit discussion" },
];

// Use global fetch when available (Node >= 18), otherwise lazy-load node-fetch
const getFetch = async () => {
    if (typeof fetch !== "undefined") return fetch;
    const { default: nodeFetch } = await import("node-fetch");
    return nodeFetch;
};

// Optional: web search grounding via Tavily if TAVILY_API_KEY is set
const webSearchInterviewProcess = async (company, jobRole) => {
    try {
        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) return null;
        const f = await getFetch();
        const query = `Typical interview rounds and process for ${company} ${jobRole} interviews`;
        const body = {
            api_key: apiKey,
            query,
            search_depth: "advanced",
            include_answer: true,
            max_results: 6,
        };
        const resp = await f("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!resp.ok) return null;
        const json = await resp.json();
        const results = Array.isArray(json?.results) ? json.results : [];
        if (results.length === 0) return null;

        // Produce a compact context block
        const compact = results.slice(0, 5).map((r, idx) => {
            const title = (r.title || "").toString().trim();
            const url = (r.url || "").toString().trim();
            const content = (r.content || "")
                .toString()
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 600);
            return `Source ${
                idx + 1
            }: ${title}\nURL: ${url}\nExtract: ${content}`;
        });
        return compact.join("\n\n");
    } catch (_e) {
        return null;
    }
};

const sanitizeRounds = (rounds) => {
    try {
        if (!Array.isArray(rounds)) return DEFAULT_ROUNDS.slice(0, 3);
        const cleaned = rounds
            .filter(
                (r) =>
                    r &&
                    typeof r.roundName === "string" &&
                    typeof r.description === "string"
            )
            .map((r) => ({
                roundName: r.roundName.trim().slice(0, 60),
                description: r.description.trim().slice(0, 220),
            }));

        const unique = [];
        const seen = new Set();
        for (const r of cleaned) {
            const key = r.roundName.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(r);
            }
        }

        if (unique.length === 0) return DEFAULT_ROUNDS.slice(0, 3);
        // Enforce 3-5 range by trimming or padding with defaults
        const trimmed = unique.slice(0, 5);
        if (trimmed.length >= 3) return trimmed;
        const needed = 3 - trimmed.length;
        return trimmed.concat(DEFAULT_ROUNDS.slice(0, needed));
    } catch {
        return DEFAULT_ROUNDS.slice(0, 3);
    }
};

export const suggestRounds = async (company, jobRole, jobDescription) => {
    try {
        const safeCompany = (company || "").toString().trim().slice(0, 120);
        const safeRole = (jobRole || "").toString().trim().slice(0, 120);
        const safeJD = (jobDescription || "").toString().trim().slice(0, 4000);

        // Simple in-memory cache with TTL
        const cacheKey = `${safeCompany}__${safeRole}__${safeJD}`;
        const now = Date.now();
        if (!global.__roundsCache) global.__roundsCache = new Map();
        const cached = global.__roundsCache.get(cacheKey);
        if (cached && now - cached.timestamp < 5 * 60 * 1000) {
            return cached.value;
        }

        // Try to ground with web context if available
        const webContext = await webSearchInterviewProcess(
            safeCompany,
            safeRole
        );

        const prompt = `You are generating a realistic interview process tailored to the company and role.

            Company: ${safeCompany}
            Role: ${safeRole}
            Job Description: ${safeJD}

            Context (from the web, may be incomplete):
            ${webContext ? webContext : "<no web context available>"}

            Requirements:
            1. Return ONLY a JSON array (no prose), with 3 to 5 items in realistic order.
            2. Each item must be an object: { "roundName": string (2–4 words), "description": concise string }.
            3. Ensure rounds are relevant to the company and role. Prefer widely reported patterns; avoid niche or internal-only steps unless corroborated by multiple sources.
            4. If web context is weak or missing, fall back to industry-standard processes for similar companies/roles.
            5. Do not include company-internal secrets or speculative steps.
        `;

        const text = (await generateJSON(prompt)) || "";
        let rounds;
        try {
            rounds = JSON.parse(text);
        } catch {
            return sanitizeRounds(DEFAULT_ROUNDS);
        }

        const finalRounds = sanitizeRounds(rounds);
        global.__roundsCache.set(cacheKey, { value: finalRounds, timestamp: now });
        return finalRounds;
    } catch (error) {
        console.error("Error suggesting rounds:", error);
        return sanitizeRounds(DEFAULT_ROUNDS);
    }
};
