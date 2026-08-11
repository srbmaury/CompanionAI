import CandidateAttempt from "../../models/CandidateAttempt.js";
import { generateFeedbackForAnswer } from "../../utils/generateFeedback.js";
import metrics from "../../metrics/index.js";

export default async function candidateAssessmentProcessor(job) {
    const attempt = await CandidateAttempt.findOne({ _id: job.data?.attemptId, status: "evaluating" });
    if (!attempt) return { skipped: true };
    try {
        const items = attempt.rounds.flatMap((round) => round.questions);
        let completed = 0;
        const allScores = [];
        for (const round of attempt.rounds) {
            const roundScores = [];
            for (const item of round.questions) {
                const combined = [item.answer, item.spokenExplanation ? `Spoken explanation:\n${item.spokenExplanation}` : "", item.followUpQuestion ? `Follow-up question: ${item.followUpQuestion}\nFollow-up answer: ${item.followUpAnswer}` : ""].filter(Boolean).join("\n\n");
                const feedback = await generateFeedbackForAnswer({ questionText: item.text, userAnswer: combined });
                item.feedbackComment = feedback.comment; item.suggestions = feedback.suggestions; item.score = feedback.score;
                roundScores.push(feedback.score); allScores.push(feedback.score);
                completed += 1; await job.updateProgress?.(Math.round(completed / items.length * 100));
            }
            round.score = roundScores.length ? Math.round((roundScores.reduce((a, b) => a + b, 0) / roundScores.length) * 10) / 10 : 0;
        }
        attempt.overallScore = allScores.length ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10 : 0;
        attempt.status = "submitted"; attempt.submittedAt = new Date(); attempt.evaluationError = ""; await attempt.save();
        try { metrics.candidateAssessmentCompletionDurationSeconds.observe(Math.max((attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000, 0)); } catch {}
        return { submitted: true, score: attempt.overallScore };
    } catch (error) {
        const finalAttempt = Number(job.attemptsMade || 0) + 1 >= Number(job.opts?.attempts || 1);
        if (finalAttempt) await CandidateAttempt.updateOne({ _id: attempt._id, status: "evaluating" }, { $set: { status: "evaluation_failed", evaluationError: (error?.message || "Evaluation failed").slice(0, 500) } });
        throw error;
    }
}
