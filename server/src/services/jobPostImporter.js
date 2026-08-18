import dns from "node:dns/promises";
import net from "node:net";

const MAX_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8_000;

const decodeHtml = (value = "") => value
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));

const htmlToText = (value = "") => decodeHtml(value)
    .replace(/<(script|style|noscript|svg)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/p>|<\/li>|<\/div>|<\/h\d>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();

const isPrivateAddress = (address) => {
    const normalized = String(address || "").toLowerCase().split("%")[0];
    if (normalized.startsWith("::ffff:")) return true;
    if (net.isIP(normalized) === 4) {
        const [a, b] = normalized.split(".").map(Number);
        return a === 0 || a === 10 || a === 127 || a >= 224 ||
            (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && (b === 0 || b === 168)) || (a === 100 && b >= 64 && b <= 127) ||
            (a === 198 && (b === 18 || b === 19));
    }
    if (net.isIP(normalized) === 6) {
        return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") ||
            normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
            normalized.startsWith("fea") || normalized.startsWith("feb") || normalized.startsWith("::ffff:127.");
    }
    return true;
};

export const validatePublicJobUrl = async (rawUrl) => {
    let url;
    try { url = new URL(rawUrl); } catch { throw new Error("Enter a valid job-post URL."); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Only public HTTP(S) job-post URLs are allowed.");
    if ((url.protocol === "http:" && url.port && url.port !== "80") || (url.protocol === "https:" && url.port && url.port !== "443")) throw new Error("Custom URL ports are not allowed.");
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
    if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname === "metadata.google.internal") throw new Error("Private network URLs are not allowed.");
    if (net.isIP(hostname) && isPrivateAddress(hostname)) throw new Error("Private network URLs are not allowed.");
    let addresses;
    try { addresses = await dns.lookup(hostname, { all: true, verbatim: true }); }
    catch { throw new Error("The job-post hostname could not be resolved."); }
    if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("Private network URLs are not allowed.");
    return url;
};

const readLimitedBody = async (response) => {
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > MAX_BYTES) throw new Error("The job post is too large to import.");
    if (!response.body?.getReader) return (await response.text()).slice(0, MAX_BYTES);
    const reader = response.body.getReader(); const chunks = []; let size = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) { await reader.cancel(); throw new Error("The job post is too large to import."); }
        chunks.push(value);
    }
    const result = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder().decode(result);
};

const metaContent = (html, key) => {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
        new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i"),
        new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"),
    ];
    return decodeHtml(patterns.map((pattern) => html.match(pattern)?.[1]).find(Boolean) || "").trim();
};

const findJobPosting = (value) => {
    if (Array.isArray(value)) return value.map(findJobPosting).find(Boolean);
    if (!value || typeof value !== "object") return null;
    const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
    if (types.some((type) => String(type).toLowerCase() === "jobposting")) return value;
    return findJobPosting(value["@graph"]);
};

export const extractJobPost = (html, sourceUrl) => {
    let posting = null;
    for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        try { posting = findJobPosting(JSON.parse(match[1])); } catch { /* Ignore malformed publisher metadata. */ }
        if (posting) break;
    }
    const pageTitle = decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+/g, " ").trim();
    const company = htmlToText(posting?.hiringOrganization?.name || metaContent(html, "og:site_name")).slice(0, 120);
    const jobRole = htmlToText(posting?.title || metaContent(html, "og:title") || pageTitle.split(/\s+[|–—-]\s+/)[0]).slice(0, 120);
    const descriptionSource = posting?.description || metaContent(html, "description") || metaContent(html, "og:description") || html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] || "";
    const jobDescription = htmlToText(descriptionSource).slice(0, 4_000);
    if (jobRole.length < 2 || jobDescription.length < 20) throw new Error("We couldn’t extract enough job details from this page. Enter them manually instead.");
    return { company, jobRole, jobDescription, sourceUrl, extractedAt: new Date().toISOString() };
};

export const importJobPost = async (rawUrl) => {
    let current = await validatePublicJobUrl(rawUrl);
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
        const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
        let response;
        try { response = await fetch(current, { redirect: "manual", signal: controller.signal, headers: { "user-agent": "CompanionAI-JobImporter/1.0", accept: "text/html,text/plain;q=0.9" } }); }
        catch (error) { throw new Error(error?.name === "AbortError" ? "The job post took too long to respond." : "The job post could not be reached."); }
        finally { clearTimeout(timeout); }
        if ([301, 302, 303, 307, 308].includes(response.status)) {
            const location = response.headers.get("location");
            if (!location || redirects === MAX_REDIRECTS) throw new Error("The job post redirected too many times.");
            current = await validatePublicJobUrl(new URL(location, current).toString());
            continue;
        }
        if (!response.ok) throw new Error(`The job post returned HTTP ${response.status}.`);
        const type = (response.headers.get("content-type") || "").toLowerCase();
        if (!type.includes("text/html") && !type.includes("text/plain")) throw new Error("The URL must return an HTML or text job post.");
        return extractJobPost(await readLimitedBody(response), current.toString());
    }
    throw new Error("The job post could not be imported.");
};
