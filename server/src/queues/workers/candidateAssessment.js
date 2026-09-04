import CandidateAttempt from "../../models/CandidateAttempt.js";
import { FEEDBACK_ENGINE_VERSION, FEEDBACK_PROMPT_VERSION, generateFeedbackForAnswer } from "../../utils/generateFeedback.js";
import metrics from "../../metrics/index.js";
import productionMetrics from "../../metrics/production.js";
import Assessment from "../../models/Assessment.js";
import { summarizeSystemDesignDiagram } from "../../utils/systemDesignDiagram.js";

export default async function candidateAssessmentProcessor(job) {
    const attempt = await CandidateAttempt.findOne({ _id: job.data?.attemptId, status: "evaluating" });
    if (!attempt) return { skipped: true };

    productionMetrics.assessmentEvaluationsInFlight.inc();
    let terminalOutcome = "";
    let terminalAt = null;
    try {
        const assessment = await Assessment.findById(attempt.assessment).lean();
        const items = attempt.rounds.flatMap((round) => round.questions);
        let completed = 0;
        const allScores = []; let weightedTotal = 0; let totalWeight = 0;
        for (const round of attempt.rounds) {
            const roundScores = [];
            for (const item of round.questions) {
                const diagramContext = item.diagramSummary || (item.diagramData ? summarizeSystemDesignDiagram(item.diagramData) : "");
                if (diagramContext) item.diagramSummary = diagramContext;
                const combined = [item.answer, diagramContext, item.spokenExplanation ? `Spoken explanation:\n${item.spokenExplanation}` : "", item.followUpQuestion ? `AI interviewer probe: ${item.followUpQuestion}\nCandidate response: ${item.followUpAnswer}` : ""].filter(Boolean).join("\n\n");
                const feedback = await generateFeedbackForAnswer({ questionText: item.text, userAnswer: combined, evaluationContext: round.deliveryMode === "system-design" ? { mode: "system-design", jobRole: assessment?.jobRole, jobDescription: assessment?.jobDescription, roundDescription: round.description, rubric: assessment?.rubric } : undefined });
                item.feedbackComment = feedback.comment; item.suggestions = feedback.suggestions; item.score = feedback.score;
                roundScores.push(feedback.score); allScores.push(feedback.score);
                const weight = Number(item.weight) || 1; weightedTotal += feedback.score * weight; totalWeight += weight;
                completed += 1; await job.updateProgress?.(Math.round(completed / items.length * 100));
            }
            round.score = roundScores.length ? Math.round((roundScores.reduce((a, b) => a + b, 0) / roundScores.length) * 10) / 10 : 0;
        }
        attempt.overallScore = totalWeight ? Math.round((weightedTotal / totalWeight) * 10) / 10 : 0;
        attempt.status = "submitted";
        attempt.submittedAt = new Date();
        attempt.evaluationError = "";
        attempt.evaluationMetadata = {
            engineVersion: FEEDBACK_ENGINE_VERSION,
            promptVersion: FEEDBACK_PROMPT_VERSION,
            questionCount: completed,
            completedAt: attempt.submittedAt,
        };
        await attempt.save();
        await Assessment.updateOne({ _id: attempt.assessment, "invitations.email": attempt.candidateEmail }, { $set: { "invitations.$.status": "completed" } });
        try { metrics.candidateAssessmentCompletionDurationSeconds.observe(Math.max((attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000, 0)); } catch {}
        terminalOutcome = "success";
        terminalAt = attempt.submittedAt;
        return { submitted: true, score: attempt.overallScore };
    } catch (error) {
        const finalAttempt = Number(job.attemptsMade || 0) + 1 >= Number(job.opts?.attempts || 1);
        if (finalAttempt) {
            terminalOutcome = "failure";
            terminalAt = new Date();
            await CandidateAttempt.updateOne({ _id: attempt._id, status: "evaluating" }, { $set: { status: "evaluation_failed", evaluationError: (error?.message || "Evaluation failed").slice(0, 500) } });
        }
        throw error;
    } finally {
        productionMetrics.assessmentEvaluationsInFlight.dec();
        if (terminalOutcome && terminalAt && attempt.evaluationStartedAt) {
            productionMetrics.assessmentEvaluationDurationSeconds
                .labels(terminalOutcome)
                .observe(Math.max(0, (terminalAt.getTime() - attempt.evaluationStartedAt.getTime()) / 1000));
        }
    }
}
