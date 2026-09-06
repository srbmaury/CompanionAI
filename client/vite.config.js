import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const INDEXABLE_ROUTES = [
    "/",
    "/practice",
    "/hire",
    "/docs",
    "/docs/technical-hiring/structured-technical-assessments",
    "/docs/technical-hiring/system-design-interviews",
    "/docs/technical-hiring/interview-scorecards",
    "/docs/candidates/ai-interview-practice",
    "/docs/security/human-review-and-integrity-signals",
    "/docs/hiring/oidc-sso",
    "/privacy",
    "/terms",
];

const normalizePublicOrigin = (raw) => {
    const value = String(raw || "").trim();
    if (!value) return "";
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.pathname !== "/" || url.search || url.hash) {
        throw new Error("VITE_PUBLIC_ORIGIN must be an origin only, for example https://evalcue.example");
    }
    return url.origin;
};

const seoFilesPlugin = (origin) => ({
    name: "evalcue-seo-files",
    async closeBundle() {
        if (!origin) return;
        const outDir = path.resolve(process.cwd(), "dist");
        await mkdir(outDir, { recursive: true });
        const urls = INDEXABLE_ROUTES.map((route) => `  <url><loc>${origin}${route}</loc></url>`).join("\n");
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
        const robots = [
            "User-agent: *",
            "Allow: /",
            `Sitemap: ${origin}/sitemap.xml`,
            "",
        ].join("\n");
        await Promise.all([
            writeFile(path.join(outDir, "sitemap.xml"), sitemap),
            writeFile(path.join(outDir, "robots.txt"), robots),
        ]);
    },
});

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const publicOrigin = normalizePublicOrigin(env.VITE_PUBLIC_ORIGIN);

    return {
        test: {
            environment: "jsdom",
            globals: true,
            exclude: ["e2e/**", "node_modules/**"],
        },
        plugins: [react(), seoFilesPlugin(publicOrigin)],
        build: {
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        if (id.includes("monaco-editor") || id.includes("react-monaco-editor")) return "monaco";
                        if (id.includes("@mui") || id.includes("@emotion")) return "mui";
                        if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return "react";
                    },
                },
            },
        },
        server: {
            headers: {
                "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
            },
            proxy: {
                "/api": {
                    target: "http://localhost:5000",
                    changeOrigin: true,
                    secure: false,
                },
            },
        },
    };
});
