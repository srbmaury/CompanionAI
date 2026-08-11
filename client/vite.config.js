import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    test: {
        environment: "jsdom",
        globals: true,
        exclude: ["e2e/**", "node_modules/**"],
    },
    plugins: [react()],
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
});
