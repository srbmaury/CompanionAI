import { generateJSON } from "./aiClient.js";
import { sanitizeText, normalize } from "./textUtils.js";
import { filterKeywords, STOPWORDS } from "./keywords.js";

export const getTechnicalTermsFromResume = async ({ resumeText }) => {
    const r = sanitizeText(resumeText, 4000);
    const prompt = `Return ONLY JSON: {"technical": string[]}.
Include ONLY concrete technical terms actually present in the resume: programming languages, frameworks, libraries, tools, databases, cloud services, platforms, DevOps, data/ML tools, protocols, APIs, operating systems, build/test tools, and well-known technical methodologies (e.g., TDD, Agile).
Constraints: 1-3 words each, max 60 items, no personal info, no generic words (e.g., "technical", "project", "phone").
Resume: ${r}`;
    try {
        const text = (await generateJSON(prompt)) || "{}";
        let obj = {};
        try {
            obj = JSON.parse(text);
        } catch {
            obj = {};
        }
        const arr = Array.isArray(obj?.technical)
            ? obj.technical
            : Array.isArray(obj?.topics)
            ? obj.topics
            : [];
        const set = new Set();
        for (const t of arr) {
            const n = normalize(t);
            if (!n) continue;
            if (STOPWORDS.has(n)) continue;
            set.add(n);
        }
        const looksTechnical = (term) => {
            const t = term;
            if (/[+#.]/.test(t)) return true;
            if (/c\+\+|c#|\.net|node(\.js)?|react|angular|vue|svelte|next(\.js)?|nuxt|express|nestjs|spring(\s*boot)?|django|flask|fastapi|laravel|rails|dotnet|java|python|golang|go\b|rust|typescript|javascript|kotlin|swift|objective\-?c/i.test(t)) return true;
            if (/aws|azure|gcp|kubernetes|k8s|docker|terraform|ansible|helm|istio|prometheus|grafana|datadog|sentry|new\s*relic/i.test(t)) return true;
            if (/postgres|postgresql|mysql|mariadb|mongodb|redis|dynamodb|cosmos|cassandra|elasticsearch|kafka|rabbitmq|spark|hadoop|hive|presto|trino|snowflake|redshift|bigquery/i.test(t)) return true;
            if (/graphql|rest|grpc|soap|oauth|openid|saml|jwt|websocket/i.test(t)) return true;
            if (/webpack|babel|vite|esbuild|rollup|eslint|prettier|storybook|cypress|playwright|puppeteer|selenium|jest|mocha|chai|junit|pytest/i.test(t)) return true;
            if (/linux|windows|macos|ios|android|xcode|android\s*studio|git|github|gitlab|bitbucket/i.test(t)) return true;
            if (/ci\s*\/\s*cd|ci\-cd|tdd|bdd|agile|scrum|kanban/i.test(t)) return true;
            return false;
        };
        const filtered = Array.from(filterKeywords(set)).filter(looksTechnical);
        return filtered.slice(0, 60);
    } catch (_e) {
        return [];
    }
};