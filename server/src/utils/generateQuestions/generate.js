import { generateJSON } from "./aiClient.js";
import fs from "fs";
import path from "path";
import { normalize, sanitizeText } from "./textUtils.js";
import { extractRoundKeywords } from "./roundKeywords.js";
import { getTechnicalTermsFromResume } from "./aiExtraction.js";
import { webSearchReferenceQuestions } from "./webGrounding.js";

const containsAllowed = (question, allowedSet) => {
    if (!allowedSet || allowedSet.size === 0) return true;
    const q = normalize(question);
    for (const kw of allowedSet) {
        const pattern = new RegExp(
            `(^|[^a-z0-9])${kw.replace(/[.+#]/g, (m) => `\\${m}`)}([^a-z0-9]|$)`,
            "i"
        );
        if (pattern.test(q)) return true;
    }
    return false;
};

const DSA_KEYWORDS = new Set([
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

const isDSAQuestion = (question) => containsAllowed(question, DSA_KEYWORDS);

export const generateQuestionsForRound = async ({
    company,
    jobRole,
    jobDescription,
    resumeText,
    roundName,
    roundDescription,
    deliveryMode,
    count,
    excludeTexts = [],
    dsaCountOffset = 0,
}) => {
    if (process.env.TEST_FORCE_GENERATOR_EMPTY === "true") {
        return [];
    }
    const safeCompany = sanitizeText(company, 120);
    const safeRole = sanitizeText(jobRole, 120);
    const safeJD = sanitizeText(jobDescription, 4000);
    const safeResume = sanitizeText(resumeText, 4000);
    const safeRound = sanitizeText(roundName, 60);
    const safeRoundDesc = sanitizeText(roundDescription, 400);
    const num = Math.min(Math.max(Number(count) || 8, 1), 20);

    try {
        // Build prompt and ask AI for JSON via OpenAI (fallback to Gemini)

        const roundKeywords = extractRoundKeywords(safeRound, safeRoundDesc);
        const candidateKeywords = await getTechnicalTermsFromResume({ resumeText: safeResume });

        const seedTopics = roundKeywords.size > 0 ? roundKeywords : candidateKeywords;
        const webRefs = await webSearchReferenceQuestions(seedTopics, safeRole, safeRound);

        const roundListPreview = Array.from(roundKeywords).slice(0, 60);
        const candidateListPreview = Array.from(candidateKeywords).slice(0, 60);
        const exclusionsPreview = Array.from(excludeTexts).slice(0, 60);

        const templatePath = path.join(
            path.dirname(new URL(import.meta.url).pathname),
            "prompt.txt"
        );
        const rawTemplate = fs.readFileSync(templatePath, "utf8");
        const webRefsBlock = (webRefs || [])
            .slice(0, 10)
            .map((q, i) => `- Ref${i + 1}: ${q}`)
            .join("\n") || "<none>";
        const replacements = {
            num: String(num),
            company: safeCompany,
            role: safeRole,
            round: safeRound,
            roundDesc: safeRoundDesc,
            deliveryMode,
            jobDesc: safeJD,
            resume: safeResume,
            roundTopics: roundListPreview.join(", "),
            candidateTopics: candidateListPreview.join(", "),
            exclusions: exclusionsPreview.join(" | "),
            webRefs: webRefsBlock,
        };
        const prompt = rawTemplate.replace(/\{\{(.*?)\}\}/g, (_, key) => {
            const k = String(key).trim();
            return Object.prototype.hasOwnProperty.call(replacements, k)
                ? replacements[k]
                : "";
        });

        const text = (await generateJSON(prompt)) || "[]";
        let arr;
        try {
            arr = JSON.parse(text);
        } catch {
            arr = [];
        }
        const cleaned = Array.isArray(arr) ? arr : [];
        const out = [];
        let dsaCount = 0;
        const allowedKeywords = new Set(
            Array.from(roundKeywords.size > 0 ? roundKeywords : candidateKeywords)
        );
        const seen = new Set(
            Array.from(excludeTexts || []).map((t) => normalize(String(t)).slice(0, 200))
        );
        for (const item of cleaned) {
            const rawText = typeof item === "string" ? item : item?.text;
            const rawTags = Array.isArray(item?.tags) ? item.tags : [];
            const s = sanitizeText(rawText, 200);
            if (!s) continue;
            const key = normalize(s).slice(0, 200);
            if (seen.has(key)) continue;
            if (roundKeywords.size > 0 && !containsAllowed(s, roundKeywords))
                continue;
            if (
                candidateKeywords.size > 0 &&
                !containsAllowed(s, allowedKeywords)
            ) {
                if (
                    !(
                        roundKeywords.size > 0 &&
                        containsAllowed(s, roundKeywords)
                    )
                )
                    continue;
            }
            const looksDSA =
                isDSAQuestion(s) ||
                rawTags.some((t) => /\bdsa\b/i.test(String(t)));
            if (looksDSA && dsaCountOffset + dsaCount >= 3) continue;
            const tags = Array.from(
                new Set(
                    rawTags
                        .concat(
                            Array.from(roundKeywords).filter((kw) =>
                                containsAllowed(s, new Set([kw]))
                            )
                        )
                        .concat(
                            Array.from(candidateKeywords).filter((kw) =>
                                containsAllowed(s, new Set([kw]))
                            )
                        )
                        .slice(0, 8)
                )
            )
                .map((t) => (t || "").toString().toLowerCase().trim())
                .filter(Boolean)
                .slice(0, 5);
            if (looksDSA && !tags.some((t) => t === "dsa")) tags.unshift("dsa");
            seen.add(key);
            if (looksDSA) dsaCount++;
            out.push({ text: s, tags });
            if (out.length >= num) break;
        }
        return out;
    } catch (error) {
        console.error(error);
        throw error;
    }
};