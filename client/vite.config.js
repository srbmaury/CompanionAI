import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    test: {
        environment: "jsdom",
        globals: true,
    },
    plugins: [react()],
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
