import { useEffect } from "react";

export default function Seo({ title, description, canonicalPath, structuredData }) {
    useEffect(() => {
        const previousTitle = document.title;
        document.title = title;

        const ensureMeta = (selector, attributes) => {
            let element = document.head.querySelector(selector);
            const created = !element;
            if (!element) {
                element = document.createElement("meta");
                document.head.appendChild(element);
            }
            Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
            return { element, created };
        };

        const descriptionMeta = ensureMeta('meta[name="description"]', { name: "description", content: description });
        const ogTitle = ensureMeta('meta[property="og:title"]', { property: "og:title", content: title });
        const ogDescription = ensureMeta('meta[property="og:description"]', { property: "og:description", content: description });
        const ogType = ensureMeta('meta[property="og:type"]', { property: "og:type", content: "website" });

        let canonical = document.head.querySelector('link[rel="canonical"]');
        const canonicalCreated = !canonical;
        if (!canonical) {
            canonical = document.createElement("link");
            canonical.rel = "canonical";
            document.head.appendChild(canonical);
        }
        canonical.href = `${window.location.origin}${canonicalPath}`;

        let jsonLd;
        if (structuredData) {
            jsonLd = document.createElement("script");
            jsonLd.type = "application/ld+json";
            jsonLd.dataset.companionaiSeo = "true";
            jsonLd.textContent = JSON.stringify(structuredData);
            document.head.appendChild(jsonLd);
        }

        return () => {
            document.title = previousTitle;
            [descriptionMeta, ogTitle, ogDescription, ogType].forEach(({ element, created }) => { if (created) element.remove(); });
            if (canonicalCreated) canonical.remove();
            if (jsonLd) jsonLd.remove();
        };
    }, [canonicalPath, description, structuredData, title]);

    return null;
}
