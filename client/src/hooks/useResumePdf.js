import { useState, useEffect } from "react";
import api from "../api/axios";

/**
 * Fetches a PDF resume via authenticated axios (not a bare browser request)
 * and returns a revocable blob URL suitable for use in an <iframe>.
 */
export const useResumePdf = ({ resumeOpen, resumePreviewPath, resumeFileType }) => {
    const [resumeBlobUrl, setResumeBlobUrl] = useState("");

    useEffect(() => {
        if (!resumeOpen || !resumePreviewPath || resumeFileType !== "application/pdf") return;
        let cancelled = false;
        let objectUrl = "";
        api.get(resumePreviewPath, { responseType: "blob" })
            .then((res) => {
                if (cancelled) return;
                objectUrl = URL.createObjectURL(res.data);
                setResumeBlobUrl(objectUrl);
            })
            .catch(() => { if (!cancelled) setResumeBlobUrl(""); });
        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            setResumeBlobUrl("");
        };
    }, [resumeOpen, resumePreviewPath, resumeFileType]);

    return resumeBlobUrl;
};
