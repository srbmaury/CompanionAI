import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import api from "../api/axios";
import { storage, storageKeys } from "../utils/interviewStorage";
import { pollJobStatus } from "../utils/pollJobStatus";
import { trackEvent } from "../utils/analytics";

/**
 * Manages the conversational interview mode: state machine, draft persistence,
 * answer submission, clarification, and round completion.
 */
export const useConversational = ({
    interviewId,
    selectedRound,
    isConversational,
    setSelectedRound,
    selectRound,
    setInterview,
    showToast,
    clearDraftsForRound,
}) => {
    const [convState, setConvState] = useState({ index: 0, current: null, done: false });
    const [convAnswer, setConvAnswer] = useState("");
    const [convSavedAt, setConvSavedAt] = useState(null);
    const [convSubmitting, setConvSubmitting] = useState(false);
    const [convRoundSubmitting, setConvRoundSubmitting] = useState(false);
    const [convFeedbackProgress, setConvFeedbackProgress] = useState(0);
    const [pendingFollowUp, setPendingFollowUp] = useState(null); // { question, qIndex, originalAnswer }
    const pendingSavesRef = useRef(new Set());

    const syncConvStateFromRound = useCallback((round) => {
        if (!round || round.deliveryMode !== "conversational") return;
        const limit = Math.min(Number(round.questionLimit) || 8, round.questions?.length || 0);
        if (round.status === "completed") {
            setConvState({ index: 0, current: null, done: true });
            setConvAnswer("");
            return;
        }
        if (limit === 0) {
            setConvState({ index: 0, current: null, done: false });
            setConvAnswer("");
            return;
        }
        let idx = Number(round.conversationalIndex) || 0;
        if (idx >= limit) {
            setConvState({ index: limit, current: null, done: true });
            setConvAnswer("");
            return;
        }
        if (idx > 0) {
            const prev = round.questions?.[idx - 1];
            if (prev && !prev.answerGiven) idx = idx - 1;
        }
        const item = round.questions?.[idx];
        setConvState({ index: idx, current: item?.question || null, done: false });
    }, []);

    // Sync state when round data changes (also fires when questions load for the first time)
    useEffect(() => {
        if (!selectedRound || !isConversational) return;
        syncConvStateFromRound(selectedRound);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedRound?._id, isConversational, selectedRound?.conversationalIndex, selectedRound?.status, selectedRound?.questions?.length]);

    // Restore saved draft when the active question changes
    useEffect(() => {
        if (!selectedRound || !isConversational || !convState || convState.done) return;
        const key = storageKeys.conv(interviewId, selectedRound._id, convState.index);
        const saved = storage.get(key);
        if (typeof saved === "string" && saved !== convAnswer) setConvAnswer(saved);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [interviewId, selectedRound?._id, isConversational, convState.index, convState.current]);

    // Persist draft on every keystroke
    useEffect(() => {
        if (!selectedRound || !isConversational || !convState || convState.done || !convState.current) return;
        const trimmed = (convAnswer || "").trim();
        if (!trimmed) return;
        storage.set(storageKeys.conv(interviewId, selectedRound._id, convState.index), convAnswer);
        try { setConvSavedAt(Date.now()); } catch { void 0; }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [convAnswer]);

    const convViewState = useMemo(() => {
        if (!selectedRound) return convState;
        return { ...convState, done: selectedRound.status === "completed" || convState.done };
    }, [convState, selectedRound]);

    const handleFollowUpDone = useCallback(async (followUpAnswer = "") => {
        if (!pendingFollowUp) return;
        const { qIndex, originalAnswer, question } = pendingFollowUp;
        const safeFollowUp = (followUpAnswer || "").toString().trim();
        if (safeFollowUp) {
            try {
                await api.post(`/questions/${selectedRound._id}/follow-up-answer`, { index: qIndex, question, answer: safeFollowUp });
            } catch (error) {
                showToast("warning", error?.response?.data?.message || "Follow-up answer could not be saved.");
                return;
            }
        }
        setPendingFollowUp(null);
        setSelectedRound((prev) => {
            if (!prev) return prev;
            const copy = { ...prev, questions: [...(prev.questions || [])] };
            if (copy.questions[qIndex]) {
                copy.questions[qIndex] = { ...copy.questions[qIndex], answerGiven: originalAnswer, followUpQuestion: safeFollowUp ? question : undefined, followUpAnswer: safeFollowUp || undefined };
            }
            const lim = Math.min(Number(copy.questionLimit) || 8, copy.questions?.length || 0);
            copy.conversationalIndex = qIndex + 1;
            if (qIndex + 1 >= lim) copy.status = "completed";
            setInterview((prevInt) => {
                if (!prevInt) return prevInt;
                return {
                    ...prevInt,
                    rounds: (prevInt.rounds || []).map((r) =>
                        r.round._id === copy._id ? { ...r, round: copy } : r
                    ),
                };
            });
            setTimeout(() => syncConvStateFromRound(copy), 0);
            return copy;
        });
        setConvAnswer("");
    }, [pendingFollowUp, selectedRound?._id, setSelectedRound, setInterview, showToast, syncConvStateFromRound]);

    const handleSubmitAnswer = useCallback(async (answer) => {
        if (!selectedRound || !isConversational || pendingFollowUp) return;
        const currentIndex = convState.index;
        if (currentIndex === 0) trackEvent("first_answer_submitted");
        setConvSubmitting(true);
        const limit = Math.min(Number(selectedRound?.questionLimit) || 8, selectedRound?.questions?.length || 0);
        const isLast = currentIndex + 1 >= limit && limit > 0;

        try { storage.remove(storageKeys.conv(interviewId, selectedRound._id, currentIndex)); } catch { void 0; }

        if (isLast) {
            // Optimistic advance then save + feedback
            setSelectedRound((prev) => {
                if (!prev) return prev;
                const copy = { ...prev, questions: [...(prev.questions || [])] };
                if (copy.questions[currentIndex]) {
                    copy.questions[currentIndex] = { ...copy.questions[currentIndex], answerGiven: answer };
                }
                copy.conversationalIndex = currentIndex + 1;
                copy.status = "completed";
                setInterview((prevInt) => {
                    if (!prevInt) return prevInt;
                    return {
                        ...prevInt,
                        rounds: (prevInt.rounds || []).map((r) =>
                            r.round._id === copy._id ? { ...r, round: copy } : r
                        ),
                    };
                });
                setTimeout(() => syncConvStateFromRound(copy), 0);
                return copy;
            });
            setConvAnswer("");
            try {
                setConvRoundSubmitting(true);
                setConvFeedbackProgress(0);
                const resp = await api.post(`/questions/${selectedRound._id}/answer`, { index: currentIndex, answer });
                const jobId = resp?.data?.feedbackJobId;
                if (jobId) {
                    await pollJobStatus("bulk-feedback", jobId, setConvFeedbackProgress);
                }
                const { data } = await api.get(`/interviews/${interviewId}`);
                setInterview(data);
                const updated = data.rounds.find((r) => r.round._id === selectedRound._id)?.round;
                if (updated) selectRound(updated);
                trackEvent("round_completed");
            } catch (e) {
                console.error("final answer submit error", e);
                showToast("warning", "Failed to save final answer or load feedback.");
            } finally {
                setConvRoundSubmitting(false);
                setConvSubmitting(false);
                setConvFeedbackProgress(0);
            }
        } else {
            // Save answer and fetch follow-up question in parallel
            try {
                const [, fuResult] = await Promise.allSettled([
                    api.post(`/questions/${selectedRound._id}/answer`, { index: currentIndex, answer })
                        .catch((e) => {
                            console.error("submit answer error", e);
                            showToast("warning", "Failed to save answer. Retrying may help.");
                        }),
                    Promise.race([
                        api.post(`/questions/${selectedRound._id}/follow-up`, { index: currentIndex, answer }),
                        new Promise((r) => setTimeout(() => r({ data: { followUp: null } }), 5000)),
                    ]),
                ]);
                const followUp = fuResult.status === "fulfilled" ? (fuResult.value?.data?.followUp || null) : null;
                if (followUp) {
                    setPendingFollowUp({ question: followUp, qIndex: currentIndex, originalAnswer: answer });
                    setConvAnswer("");
                } else {
                    setSelectedRound((prev) => {
                        if (!prev) return prev;
                        const copy = { ...prev, questions: [...(prev.questions || [])] };
                        if (copy.questions[currentIndex]) {
                            copy.questions[currentIndex] = { ...copy.questions[currentIndex], answerGiven: answer };
                        }
                        const lim = Math.min(Number(copy.questionLimit) || 8, copy.questions?.length || 0);
                        copy.conversationalIndex = currentIndex + 1;
                        if (currentIndex + 1 >= lim) copy.status = "completed";
                        setInterview((prevInt) => {
                            if (!prevInt) return prevInt;
                            return {
                                ...prevInt,
                                rounds: (prevInt.rounds || []).map((r) =>
                                    r.round._id === copy._id ? { ...r, round: copy } : r
                                ),
                            };
                        });
                        setTimeout(() => syncConvStateFromRound(copy), 0);
                        return copy;
                    });
                    setConvAnswer("");
                }
            } finally {
                setConvSubmitting(false);
            }
        }
    }, [selectedRound, isConversational, convState.index, interviewId, pendingFollowUp, showToast, selectRound, setSelectedRound, setInterview, syncConvStateFromRound]);

    const handleClarify = useCallback(async (message) => {
        if (!selectedRound || !isConversational) return;
        try {
            const { data } = await api.post(`/questions/${selectedRound._id}/clarify`, { message });
            const ans = (data?.answer || "").toString();
            if (ans) showToast("info", ans, true);
        } catch (e) {
            console.error("clarify error", e);
            showToast("error", e?.response?.data?.message || "Failed to clarify.");
        }
    }, [selectedRound, isConversational, showToast]);

    const handleCompleteRound = useCallback(async () => {
        if (!selectedRound) return;
        try {
            setConvRoundSubmitting(true);
            // Flush any in-flight saves
            try {
                const pending = Array.from(pendingSavesRef.current || []);
                if (pending.length > 0) {
                    await Promise.race([
                        Promise.allSettled(pending),
                        new Promise((res) => setTimeout(res, 1500)),
                    ]);
                }
            } catch { void 0; }

            let latest;
            try {
                const { data } = await api.get(`/interviews/${interviewId}`);
                latest = data;
                setInterview(data);
            } catch { void 0; }

            const roundForFeedback = latest?.rounds?.find((r) => r.round?._id === selectedRound._id)?.round || selectedRound;

            try {
                setConvFeedbackProgress(0);
                const answered = (roundForFeedback.questions || [])
                    .map((q, i) => {
                        const original = (q.answerGiven || "").toString().trim();
                        const followUp = q.followUpQuestion && q.followUpAnswer
                            ? `\n\nFollow-up question: ${q.followUpQuestion}\nFollow-up answer: ${q.followUpAnswer}`
                            : "";
                        return { index: i, questionId: q.question?._id, answer: `${original}${followUp}`.trim() };
                    })
                    .filter((it) => it.questionId && it.answer.length > 0);
                if (answered.length > 0) {
                    const { data: job } = await api.post(`/jobs/bulk-feedback`, { roundId: selectedRound._id, items: answered, attach: true });
                    if (job?.jobId) {
                        await pollJobStatus("bulk-feedback", job.jobId, setConvFeedbackProgress);
                    }
                }
            } catch (e) {
                console.error("bulk feedback (conversational) error", e);
            }

            await api.post(`/questions/${selectedRound._id}/complete`);
            const { data } = await api.get(`/interviews/${interviewId}`);
            setInterview(data);
            clearDraftsForRound(selectedRound);

            const idxNow = (data.rounds || []).findIndex((r) => r.round._id === selectedRound._id);
            const nextRound = idxNow >= 0 && idxNow + 1 < data.rounds.length ? data.rounds[idxNow + 1].round : null;
            if (nextRound) {
                selectRound(nextRound);
            } else {
                const updatedSelf = data.rounds.find((r) => r.round._id === selectedRound._id)?.round;
                if (updatedSelf) selectRound(updatedSelf);
            }
            showToast("success", "Round submitted. Preparing feedback in background.");
        } catch (e) {
            console.error("complete round error", e);
            showToast("error", e?.response?.data?.message || "Failed to complete round.");
        } finally {
            setConvRoundSubmitting(false);
            setConvFeedbackProgress(0);
        }
    }, [selectedRound, interviewId, clearDraftsForRound, selectRound, setInterview, showToast]);

    return {
        convState, convViewState,
        convAnswer, setConvAnswer,
        convSavedAt,
        convSubmitting, convRoundSubmitting, convFeedbackProgress,
        syncConvStateFromRound,
        pendingFollowUp,
        handleSubmitAnswer, handleFollowUpDone, handleClarify, handleCompleteRound,
    };
};
