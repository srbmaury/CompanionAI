import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/axios";

const DEFAULT_INTERVAL_MS = 7000;
const MIN_CONTEXT_CHARS = 80;
const MIN_NEW_CHARS = 35;
const FIRST_INTERACTION_CONTEXT_CHARS = 140;
const MAX_SILENT_MS = 45000;

const looksLikeCandidateQuestion = (value = "") => {
    const tail = value.trim().slice(-180);
    if (tail.length < 12) return false;
    if (tail.endsWith("?")) return true;
    return /\b(what|which|how|when|where|who)\b|\b(should|can|could|would)\s+(i|we)\b|\b(do|are|is)\s+(we|there|it)\b/i.test(tail);
};

/**
 * Periodically gives the AI interviewer a chance to participate during a
 * system-design discussion. Candidate clarification questions are handled
 * immediately; otherwise the first meaningful probe is guaranteed once enough
 * context exists, and long silent stretches trigger another interviewer turn.
 */
export const useSystemDesignDiscussion = ({
    enabled,
    endpoint,
    headers = {},
    transcript = "",
    diagramData = "",
    onInterjection,
    skipAuthRedirect = false,
    intervalMs = DEFAULT_INTERVAL_MS,
}) => {
    const [interjections, setInterjections] = useState([]);
    const [checking, setChecking] = useState(false);
    const busyRef = useRef(false);
    const lastCheckedLengthRef = useRef(0);
    const lastCheckedAtRef = useRef(0);
    const lastInterjectionAtRef = useRef(0);
    const transcriptRef = useRef(transcript);
    const diagramRef = useRef(diagramData);
    const interjectionsRef = useRef(interjections);
    const onInterjectionRef = useRef(onInterjection);

    useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
    useEffect(() => { diagramRef.current = diagramData; }, [diagramData]);
    useEffect(() => { interjectionsRef.current = interjections; }, [interjections]);
    useEffect(() => { onInterjectionRef.current = onInterjection; }, [onInterjection]);

    const checkpoint = useCallback(async ({ force = false } = {}) => {
        if (!enabled || !endpoint || busyRef.current) return null;
        if (typeof document !== "undefined" && document.hidden) return null;
        const currentTranscript = (transcriptRef.current || "").trim();
        const now = Date.now();
        const newChars = currentTranscript.length - lastCheckedLengthRef.current;
        const previousInterjections = interjectionsRef.current;
        const candidateAskedQuestion = newChars >= 12 && looksLikeCandidateQuestion(currentTranscript);
        const needsFirstInteraction = previousInterjections.length === 0 && currentTranscript.length >= FIRST_INTERACTION_CONTEXT_CHARS;
        const silentTooLong = previousInterjections.length > 0
            && currentTranscript.length >= MIN_CONTEXT_CHARS
            && now - lastInterjectionAtRef.current >= MAX_SILENT_MS;
        const forceInteraction = force || candidateAskedQuestion || needsFirstInteraction || silentTooLong;

        if (!forceInteraction) {
            if (currentTranscript.length < MIN_CONTEXT_CHARS) return null;
            if (newChars < MIN_NEW_CHARS) return null;
            if (now - lastCheckedAtRef.current < Math.max(3500, intervalMs - 1500)) return null;
        }

        busyRef.current = true;
        setChecking(true);
        lastCheckedLengthRef.current = currentTranscript.length;
        lastCheckedAtRef.current = now;
        try {
            const { data } = await api.post(endpoint, {
                transcript: currentTranscript.slice(-20000),
                diagramData: (diagramRef.current || "").slice(0, 500000),
                previousInterjections: previousInterjections.map((item) => item.text).slice(-8),
                forceInteraction,
                candidateAskedQuestion,
            }, { headers, skipAuthRedirect });
            if (data?.shouldInterrupt && data?.interjection) {
                const item = {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    text: data.interjection,
                    kind: data.kind || "challenge",
                    at: new Date().toISOString(),
                };
                lastInterjectionAtRef.current = Date.now();
                setInterjections((current) => [...current, item].slice(-12));
                await onInterjectionRef.current?.(item);
                return item;
            }
            return null;
        } catch (error) {
            // A live-interviewer checkpoint must never block the design session.
            console.debug("System design checkpoint skipped", error?.message || error);
            return null;
        } finally {
            busyRef.current = false;
            setChecking(false);
        }
    }, [enabled, endpoint, headers, intervalMs, skipAuthRedirect]);

    useEffect(() => {
        if (!enabled || !endpoint) return undefined;
        const timer = window.setInterval(() => { checkpoint(); }, Math.max(5000, intervalMs));
        return () => window.clearInterval(timer);
    }, [checkpoint, enabled, endpoint, intervalMs]);

    useEffect(() => {
        if (!enabled) {
            setInterjections([]);
            lastCheckedLengthRef.current = 0;
            lastCheckedAtRef.current = 0;
            lastInterjectionAtRef.current = 0;
        }
    }, [enabled]);

    return { interjections, checking, checkpoint };
};

export default useSystemDesignDiscussion;
