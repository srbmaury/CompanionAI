// Lightweight Tavily search for interview experiences
const getFetch = async () => {
    if (typeof fetch !== "undefined") return fetch;
    const { default: nodeFetch } = await import("node-fetch");
    return nodeFetch;
};

export const searchExperiences = async (req, res) => {
    try {
        const company = (req.query.company || "").toString().trim().slice(0, 120);
        const role = (req.query.role || "").toString().trim().slice(0, 120);
        if (!company || !role) return res.status(400).json({ message: "company and role are required" });
        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) return res.json({ results: [] });
        const f = await getFetch();
        const query = `${company} ${role} interview experience`;
        const body = { api_key: apiKey, query, search_depth: "advanced", include_answer: true, max_results: 8 };
        const resp = await f("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!resp.ok) return res.json({ results: [] });
        const json = await resp.json();
        const out = (Array.isArray(json?.results) ? json.results : []).map((r) => ({
            title: (r.title || "").toString().trim().slice(0, 200),
            url: (r.url || "").toString().trim(),
            snippet: (r.content || "").toString().replace(/\s+/g, " ").slice(0, 400),
        }));
        return res.json({ results: out });
    } catch (e) {
        return res.json({ results: [] });
    }
};
