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
            const previous = {};
            Object.keys(attributes).forEach((key) => { previous[key] = element.getAttribute(key); });
            Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
            return { element, created, previous };
        };

        const descriptionMeta = ensureMeta('meta[name="description"]', { name: "description", content: description });
        const ogTitle = ensureMeta('meta[property="og:title"]', { property: "og:title", content: title });
        const ogDescription = ensureMeta('meta[property="og:description"]', { property: "og:description", content: description });
        const ogType = ensureMeta('meta[property="og:type"]', { property: "og:type", content: "website" });

        let canonical = document.head.querySelector('link[rel="canonical"]');
        const canonicalCreated = !canonical;
        const previousCanonicalHref = canonical?.getAttribute("href") ?? null;
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
            [descriptionMeta, ogTitle, ogDescription, ogType].forEach(({ element, created, previous }) => {
                if (created) {
                    element.remove();
                    return;
                }
                Object.entries(previous).forEach(([key, value]) => {
                    if (value == null) element.removeAttribute(key);
                    else element.setAttribute(key, value);
                });
            });
            if (canonicalCreated) canonical.remove();
            else if (previousCanonicalHref == null) canonical.removeAttribute("href");
            else canonical.setAttribute("href", previousCanonicalHref);
            if (jsonLd) jsonLd.remove();
        };
    }, [canonicalPath, description, structuredData, title]);

    return null;
}
