import { useState, useCallback, useEffect } from "react";
import api from "../api/axios";
import { storage, storageKeys } from "../utils/interviewStorage";
import { pollJobStatus } from "../utils/pollJobStatus";

/**
 * Manages online-assessment mode: answer state, draft persistence, and submission.
 */
export const useOAForm = ({
    interviewId,
    selectedRound,
    isConversational,
    roundLocked,
    selectRound,
    setInterview,
    showToast,
    clearDraftsForRound,
}) => {
    const [oaAnswers, setOaAnswers] = useState([]);
    const [oaSubmitting, setOaSubmitting] = useState(false);
    const [oaFeedbackProgress, setOaFeedbackProgress] = useState(0);

    // Reset answers and restore any saved draft when the selected OA round changes
    // Also fires when questions load (questions?.length changes from 0 → N)
    useEffect(() => {
        if (!selectedRound || isConversational) return;
        const questionCount = selectedRound.questions?.length || 0;
        const key = storageKeys.oa(interviewId, selectedRound._id);
        const saved = storage.get(key);
        const len = Math.max(questionCount, Array.isArray(saved) ? saved.length : 0);
        setOaAnswers((prev) => {
            const next = new Array(len).fill("");
            for (let i = 0; i < len; i++) {
                next[i] = (saved?.[i] ?? prev?.[i] ?? "").toString();
            }
            return next;
        });
    // The selected fields are intentional: replacing the whole round object should not erase drafts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [interviewId, selectedRound?._id, selectedRound?.questions?.length, isConversational]);

    // Persist OA drafts on every change
    useEffect(() => {
        if (!selectedRound || isConversational) return;
        const hasContent = (oaAnswers || []).some((a) => (a || "").toString().trim().length > 0);
        if (!hasContent) return;
        storage.set(storageKeys.oa(interviewId, selectedRound._id), oaAnswers);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [oaAnswers]);

    const handleOAChange = useCallback((i, val) => {
        setOaAnswers((prev) => {
            const next = [...prev];
            next[i] = val;
            return next;
        });
    }, []);

    const handleOASubmit = useCallback(async (answersOverride) => {
        if (!selectedRound || isConversational) return;
        if (roundLocked) {
            showToast("warning", "Complete the previous round first.");
            return;
        }
        if (!(Array.isArray(selectedRound.questions) && selectedRound.questions.length > 0)) {
            showToast("warning", "No questions yet. Please wait or reselect the round.");
            return;
        }
        const answersToSubmit = Array.isArray(answersOverride) ? answersOverride : oaAnswers;
        if (!(answersToSubmit || []).some((a) => (a || "").toString().trim().length > 0)) {
            showToast("warning", "Please provide at least one answer before submitting.");
            return;
        }
        try {
            setOaSubmitting(true);
            setOaFeedbackProgress(0);
            const outgoing = Array.from(
                { length: selectedRound.questions.length },
                (_, i) => (answersToSubmit?.[i] ?? "").toString()
            );
            await api.post(`/questions/${selectedRound._id}/answers`, { answers: outgoing });

            try {
                const answered = (selectedRound.questions || [])
                    .map((q, i) => ({ index: i, questionId: q.question?._id, answer: (outgoing[i] || "").toString().trim() }))
                    .filter((it) => it.questionId && it.answer.length > 0);
                if (answered.length > 0) {
                    const { data: job } = await api.post(`/jobs/bulk-feedback`, { roundId: selectedRound._id, items: answered, attach: true });
                    if (job?.jobId) {
                        await pollJobStatus("bulk-feedback", job.jobId, setOaFeedbackProgress);
                    }
                }
            } catch (e) {
                console.error("bulk feedback enqueue error", e);
            }

            await api.post(`/questions/${selectedRound._id}/complete`);
            const { data } = await api.get(`/interviews/${interviewId}`);
            setInterview(data);
            const updated = data.rounds.find((r) => r.round._id === selectedRound._id)?.round;
            if (updated) selectRound(updated);
            clearDraftsForRound(selectedRound);
            showToast("success", "Round submitted successfully.");
        } catch (e) {
            console.error("OA submit error", e);
            showToast("error", e?.response?.data?.message || "Failed to submit round.");
        } finally {
            setOaSubmitting(false);
            setOaFeedbackProgress(0);
        }
    }, [selectedRound, isConversational, roundLocked, oaAnswers, interviewId, selectRound, setInterview, showToast, clearDraftsForRound]);

    return { oaAnswers, setOaAnswers, oaSubmitting, oaFeedbackProgress, handleOAChange, handleOASubmit };
};
