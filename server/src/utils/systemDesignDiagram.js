export function summarizeSystemDesignDiagram(diagramData) {
    if (!diagramData) return "";
    try {
        const scene = typeof diagramData === "string" ? JSON.parse(diagramData) : diagramData;
        if (!scene || !Array.isArray(scene.elements) || scene.elements.length > 1000) return "";
        const visible = scene.elements.filter((element) => element && !element.isDeleted);
        const counts = visible.reduce((result, element) => ({ ...result, [element.type || "unknown"]: (result[element.type || "unknown"] || 0) + 1 }), {});
        const clean = (text) => String(text || "").replace(/\s+/g, " ").trim().slice(0, 160);
        const textByContainer = new Map(visible.filter((element) => element.type === "text" && element.containerId && clean(element.text)).map((element) => [element.containerId, clean(element.text)]));
        const elementById = new Map(visible.map((element) => [element.id, element]));
        const labelFor = (id) => {
            const element = elementById.get(id);
            if (!element) return "unlabelled component";
            return clean(element.text) || textByContainer.get(id) || `${element.type || "component"} ${String(id || "").slice(0, 6)}`;
        };
        const labels = visible.map((element) => clean(element.text)).filter(Boolean).slice(0, 50);
        const connections = visible.filter((element) => ["arrow", "line"].includes(element.type) && (element.startBinding?.elementId || element.endBinding?.elementId)).map((element) => {
            const source = element.startBinding?.elementId ? labelFor(element.startBinding.elementId) : "unbound source";
            const target = element.endBinding?.elementId ? labelFor(element.endBinding.elementId) : "unbound target";
            const edgeLabel = textByContainer.get(element.id);
            return `${source} -> ${target}${edgeLabel ? ` (${edgeLabel})` : ""}`;
        }).slice(0, 40);
        const frames = visible.filter((element) => element.type === "frame").map((element) => clean(element.name) || labelFor(element.id)).filter(Boolean).slice(0, 20);
        const types = Object.entries(counts).map(([type, count]) => `${count} ${type}`).join(", ");
        return [
            "Machine-readable diagram evidence (infer semantics cautiously; do not judge drawing quality):",
            `Elements: ${types || "none"}.`,
            labels.length ? `Labels: ${labels.join("; ")}.` : "No readable labels were found.",
            connections.length ? `Connections:\n- ${connections.join("\n- ")}` : "No bound component-to-component connections were detected; arrows may be visually present but unbound.",
            frames.length ? `Groups/frames: ${frames.join("; ")}.` : "",
        ].filter(Boolean).join("\n").slice(0, 10000);
    } catch { return ""; }
}

export function isValidSystemDesignDiagram(diagramData) {
    if (diagramData === "") return true;
    try {
        const scene = JSON.parse(diagramData);
        return Boolean(scene && Array.isArray(scene.elements) && scene.elements.length <= 1000 && (!scene.files || typeof scene.files === "object"));
    } catch { return false; }
}
