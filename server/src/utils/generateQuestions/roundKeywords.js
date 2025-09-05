import { normalize } from "./textUtils.js";
import { STOPWORDS, filterKeywords } from "./keywords.js";

export const extractRoundKeywords = (roundName, roundDescription) => {
    const set = new Set();
    const text = `${roundName || ""} ${roundDescription || ""}`.toLowerCase();
    const addAll = (arr) => arr.forEach((t) => set.add(normalize(t)));

    const cleaned = (text || "").replace(/[^\w+.#\-\s]/g, " ");
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    for (const raw of tokens) {
        const token = raw.toLowerCase();
        if (token.length < 3) continue;
        if (STOPWORDS.has(token)) continue;
        if (/^[a-z0-9+.#\-]+$/.test(token)) set.add(token);
    }

    const isDSA =
        /(dsa|data\s*structures|algorithms|coding\s*round|online\s*assessment|oa)/i.test(
            text
        );
    const isSystemDesign =
        /(system\s*design|architecture|design\s*(round|interview)|hld|lld|scalable|distributed)/i.test(
            text
        );
    const isBehavioral =
        /(behavioral|behavioural|hr|screening|manager|culture|leadership|communication)/i.test(
            text
        );

    if (isDSA) {
        addAll([
            "dsa",
            "data structures",
            "algorithms",
            "array",
            "string",
            "linked list",
            "stack",
            "queue",
            "tree",
            "binary tree",
            "bst",
            "graph",
            "dp",
            "dynamic programming",
            "greedy",
            "recursion",
            "backtracking",
            "sorting",
            "searching",
            "hashing",
            "heap",
            "trie",
            "two pointers",
            "sliding window",
            "complexity",
            "big o",
        ]);
    }

    if (isSystemDesign) {
        addAll([
            "system design",
            "architecture",
            "scalability",
            "availability",
            "latency",
            "throughput",
            "consistency",
            "partition",
            "cap",
            "caching",
            "cache",
            "load balancing",
            "replication",
            "sharding",
            "microservices",
            "event driven",
            "message queue",
            "pub/sub",
            "api gateway",
            "rate limiting",
            "cdn",
            "database",
            "nosql",
            "sql",
            "indexing",
            "storage",
        ]);
    }

    if (isBehavioral) {
        addAll([
            "behavioral",
            "leadership",
            "ownership",
            "teamwork",
            "communication",
            "conflict",
            "ambiguity",
            "priority",
            "decision making",
            "stakeholder",
        ]);
    }

    return filterKeywords(set);
};
