import crypto from "crypto";
import Assessment from "../models/Assessment.js";
import CandidateAttempt from "../models/CandidateAttempt.js";
import { reserveCandidateInterview, releaseOrganizationUsage } from "../services/organizationUsage.js";
import { generateQuestionsForRound } from "../utils/generateQuestions.js";
import { generateFollowUp } from "../utils/generateQuestions/followUp.js";
import { isValidSystemDesignDiagram, summarizeSystemDesignDiagram } from "../utils/systemDesignDiagram.js";
import {
    initializeAdaptiveInterviewState,
    evaluateAdaptiveAnswer,
    applyEvidenceToState,
    shouldStopAdaptiveRound,
    chooseNextCompetency,
    selectResumeClaimForTarget,
    generateNextAdaptiveQuestion,
} from "../services/adaptiveInterviewEngine.js";

const tokenHash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const findPublicAssessment = (shareToken) => Assessment.findOne({ shareToken, status: "active", $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] });
const findAttempt = async (assessmentId, attemptId, rawToken) => rawToken
    ? CandidateAttempt.findOne({ _id: attemptId, assessment: assessmentId, accessTokenHash: tokenHash(rawToken) }).select("+accessTokenHash")
    : null;

const publicAttempt = (attempt) => ({
    _id: attempt._id,
    candidateName: attempt.candidateName,
    status: attempt.status,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    rounds: attempt.rounds.map((round) => ({
        _id: round._id,
        name: round.name,
        description: round.description,
        deliveryMode: round.deliveryMode || "conversational",
        adaptive: Boolean(round.adaptiveState?.enabled),
        adaptiveComplete: Boolean(round.adaptiveComplete),
        questions: round.questions.map((question) => ({
            _id: question._id,
            text: question.text,
            answer: question.answer,
            spokenExplanation: question.spokenExplanation,
            diagramData: question.diagramData,
            diagramSummary: question.diagramSummary,
            followUpQuestion: question.followUpQuestion,
            followUpAnswer: question.followUpAnswer,
        })),
    })),
});

export const createAdaptiveAssessment = async (req, res, next) => {
    try {
        const { title, jobRole, jobDescription, followUpsEnabled = true, inviteOnly = false, candidateInstructions = "", contactEmail = "", durationMinutes = 30, opensAt, expiresAt, timezone = "UTC", rounds, integrity, rubric = [], templateName = "", status = "draft" } = req.body;
        if (status === "scheduled" && (!opensAt || new Date(opensAt) <= new Date())) return res.status(400).json({ message: "Choose a future opening time before scheduling." });
        if (expiresAt && opensAt && new Date(expiresAt) <= new Date(opensAt)) return res.status(400).json({ message: "The submission deadline must be after the opening time." });

        const generatedRounds = [];
        const excludeTexts = [];
        for (const input of rounds) {
            const count = Math.min(Math.max(Number(input.questionCount) || 3, 1), 10);
            const manual = (input.questions || []).filter((item) => item?.text?.trim()).slice(0, count);
            let generated = [];
            if (manual.length < count) {
                try {
                    generated = await generateQuestionsForRound({
                        company: req.organization?.name || "",
                        jobRole,
                        jobDescription,
                        resumeText: "",
                        roundName: input.name,
                        roundDescription: [input.description, input.aiPrompt ? `Interviewer generation request: ${input.aiPrompt}` : ""].filter(Boolean).join("\n"),
                        deliveryMode: input.deliveryMode || "conversational",
                        count: count - manual.length,
                        excludeTexts: [...excludeTexts, ...manual.map((item) => item.text)],
                    });
                } catch { /* deterministic fill below keeps draft creation usable */ }
            }
            const generatedItems = (Array.isArray(generated) ? generated : []).map((item) => ({ text: typeof item === "string" ? item : item?.text })).filter((item) => item.text?.trim());
            const questions = [...manual, ...generatedItems].slice(0, count).map((item) => ({
                text: item.text.trim(),
                weight: Number(item.weight) || 1,
                competencies: Array.isArray(item.competencies) ? item.competencies : [],
                knockout: Boolean(item.knockout),
            }));
            while (questions.length < count) questions.push({ text: `Describe how you would approach ${input.name} challenge ${questions.length + 1} for a ${jobRole}.`, weight: 1, competencies: [], knockout: false });
            excludeTexts.push(...questions.map((item) => item.text));
            generatedRounds.push({
                name: input.name,
                description: input.description || "",
                deliveryMode: input.deliveryMode || "conversational",
                adaptive: (input.deliveryMode || "conversational") === "conversational" && input.adaptive !== false,
                questions,
            });
        }

        const assessment = await Assessment.create({
            organization: req.organizationId,
            createdBy: req.user._id,
            title,
            jobRole,
            jobDescription,
            followUpsEnabled,
            inviteOnly,
            candidateInstructions,
            contactEmail,
            durationMinutes,
            opensAt: opensAt || undefined,
            expiresAt: expiresAt || undefined,
            timezone,
            rounds: generatedRounds,
            integrity,
            rubric,
            templateName,
            status,
            publishedAt: status === "active" ? new Date() : undefined,
            shareToken: crypto.randomBytes(24).toString("base64url"),
        });
        return res.status(201).json(assessment);
    } catch (error) { return next(error); }
};

const makeAttemptRound = async (assessment, round) => {
    const adaptive = round.deliveryMode === "conversational" && round.adaptive === true;
    if (!adaptive) return {
        name: round.name,
        description: round.description,
        deliveryMode: round.deliveryMode || "conversational",
        adaptiveComplete: true,
        questions: round.questions.map((question) => ({ text: question.text, weight: question.weight, competencies: question.competencies, knockout: question.knockout })),
    };

    const skills = [...new Set(round.questions.flatMap((question) => question.competencies || []))];
    const state = await initializeAdaptiveInterviewState({
        jobRole: assessment.jobRole,
        jobDescription: assessment.jobDescription,
        roundName: round.name,
        roundDescription: round.description,
        skills,
        maxQuestions: round.questions.length,
    });
    const first = round.questions[0];
    return {
        name: round.name,
        description: round.description,
        deliveryMode: round.deliveryMode || "conversational",
        adaptiveState: state,
        adaptiveComplete: false,
        questions: [{
            text: first.text,
            weight: first.weight,
            competencies: first.competencies?.length ? first.competencies : [chooseNextCompetency(state)],
            knockout: first.knockout,
            difficulty: state.currentDifficulty,
            sourceType: "planned",
        }],
    };
};

export const startAdaptiveCandidateAttempt = async (req, res, next) => {
    let usageReservation = null;
    let attemptSaved = false;
    try {
        const assessment = await findPublicAssessment(req.params.shareToken);
        if (!assessment) return res.status(404).json({ message: "Assessment unavailable" });
        const candidateEmail = req.body.email.toLowerCase().trim();
        if (assessment.integrity?.enabled && req.body.integrityConsent !== true) return res.status(400).json({ message: "Consent to the configured integrity signals is required before starting this assessment." });
        const activeInvitation = req.body.invitationId ? assessment.invitations?.id(req.body.invitationId) : null;
        const validInvitation = activeInvitation && activeInvitation.status !== "revoked" && activeInvitation.email === candidateEmail ? activeInvitation : null;
        if (assessment.inviteOnly && !validInvitation) return res.status(403).json({ message: "This assessment is invitation-only. Open the invitation link sent to your email and use that invited email address." });
        const existing = await CandidateAttempt.findOne({ assessment: assessment._id, candidateEmail });
        if (existing) return res.status(409).json({ message: existing.status === "submitted" ? "This email has already submitted an attempt" : "An attempt for this email is already in progress. Continue from the browser where it was started or contact the recruiting team." });

        const usage = await reserveCandidateInterview(assessment.organization);
        if (!usage.ok) return res.status(429).json({ message: "This assessment is temporarily unavailable because the hiring team has reached its candidate interview capacity. Contact the recruiting team if you need help.", code: "HIRING_CAPACITY_REACHED" });
        usageReservation = usage.reservation;

        const rawToken = crypto.randomBytes(32).toString("base64url");
        const rounds = [];
        for (const round of assessment.rounds) rounds.push(await makeAttemptRound(assessment, round));
        const attempt = new CandidateAttempt({
            assessment: assessment._id,
            candidateEmail,
            candidateName: req.body.name.trim(),
            accessTokenHash: tokenHash(rawToken),
            rounds,
            status: "started",
            startedAt: new Date(),
            privacyConsentAt: new Date(),
            integrityConsentAt: assessment.integrity?.enabled && req.body.integrityConsent ? new Date() : undefined,
        });
        if (validInvitation) validInvitation.status = "started";
        await attempt.save();
        attemptSaved = true;
        if (validInvitation) { try { await assessment.save(); } catch {} }
        return res.status(201).json({ attemptToken: rawToken, attempt: publicAttempt(attempt) });
    } catch (error) {
        if (usageReservation && !attemptSaved) await releaseOrganizationUsage(usageReservation);
        return next(error);
    }
};

const combinedAnswer = (item) => [
    item.answer,
    item.diagramSummary,
    item.spokenExplanation ? `Spoken explanation:\n${item.spokenExplanation}` : "",
    item.followUpQuestion && item.followUpAnswer ? `Interviewer follow-up: ${item.followUpQuestion}\nCandidate: ${item.followUpAnswer}` : "",
].filter(Boolean).join("\n\n");

const advanceAdaptiveRound = async ({ assessment, attempt, roundIndex, questionIndex }) => {
    const round = attempt.rounds[roundIndex];
    const item = round?.questions?.[questionIndex];
    if (!round?.adaptiveState?.enabled || !item || item.adaptiveEvaluated) return;
    if (!item.answer?.trim() || (item.followUpQuestion && !item.followUpAnswer?.trim())) return;

    const evaluation = await evaluateAdaptiveAnswer({
        questionText: item.text,
        answerText: combinedAnswer(item),
        targetedCompetencies: item.competencies || [],
        sourceClaim: item.sourceClaim || "",
        state: round.adaptiveState,
        jobRole: assessment.jobRole,
        roundName: round.name,
    });
    item.quickEvaluation = evaluation;
    item.adaptiveEvaluated = true;
    round.adaptiveState = applyEvidenceToState(round.adaptiveState, evaluation, { questionIndex, targetedCompetencies: item.competencies || [], sourceClaim: item.sourceClaim || "" });
    const stop = shouldStopAdaptiveRound(round.adaptiveState, evaluation);
    if (stop.stop || round.questions.length >= Number(round.adaptiveState.maxQuestions || 1)) {
        round.adaptiveComplete = true;
        round.adaptiveState.completedReason = stop.reason || "Adaptive question budget completed.";
        return;
    }

    const targetCompetency = evaluation.policy?.targetCompetency || chooseNextCompetency(round.adaptiveState);
    const claim = selectResumeClaimForTarget(round.adaptiveState, targetCompetency, evaluation.policy?.sourceClaim || "");
    const next = await generateNextAdaptiveQuestion({
        interview: { jobRole: assessment.jobRole, jobDescription: assessment.jobDescription, company: "" },
        round: { name: round.name, description: round.description },
        state: round.adaptiveState,
        targetCompetency,
        difficulty: evaluation.policy?.difficulty || round.adaptiveState.currentDifficulty,
        sourceClaim: claim?.claim || "",
        excludeTexts: round.questions.map((question) => question.text),
    });
    round.questions.push({
        text: next.text,
        weight: 1,
        competencies: next.competencies?.length ? next.competencies : [targetCompetency],
        knockout: false,
        difficulty: next.difficulty,
        sourceType: next.sourceType || "adaptive",
        sourceClaim: next.sourceClaim || "",
    });
};

export const saveAdaptiveCandidateAnswer = async (req, res, next) => {
    try {
        const assessment = await findPublicAssessment(req.params.shareToken);
        if (!assessment) return res.status(404).json({ message: "Assessment unavailable" });
        const attempt = await findAttempt(assessment._id, req.params.attemptId, req.get("x-attempt-token"));
        if (!attempt || attempt.status !== "started") return res.status(401).json({ message: "Attempt unavailable" });
        const { roundIndex, questionIndex, answer, spokenExplanation, followUpAnswer, diagramData } = req.body;
        const round = attempt.rounds?.[roundIndex];
        const item = round?.questions?.[questionIndex];
        if (!item) return res.status(400).json({ message: "Invalid question" });
        if (answer !== undefined) item.answer = answer.toString().trim().slice(0, 20000);
        if (spokenExplanation !== undefined) item.spokenExplanation = spokenExplanation.toString().trim().slice(0, 5000);
        if (diagramData !== undefined) {
            if (!isValidSystemDesignDiagram(diagramData)) return res.status(400).json({ message: "Invalid or overly complex system-design diagram" });
            item.diagramData = diagramData.slice(0, 500000);
            item.diagramSummary = summarizeSystemDesignDiagram(item.diagramData);
        }
        if (followUpAnswer !== undefined) item.followUpAnswer = followUpAnswer.toString().trim().slice(0, 5000);

        if (round.adaptiveState?.enabled) {
            if (followUpAnswer !== undefined) {
                await advanceAdaptiveRound({ assessment, attempt, roundIndex, questionIndex });
            } else if (item.answer && assessment.followUpsEnabled && !item.followUpQuestion) {
                try {
                    const decision = await generateFollowUp({
                        questionText: item.text,
                        userAnswer: combinedAnswer(item),
                        jobRole: assessment.jobRole,
                        roundName: round.name,
                        competencies: item.competencies || [],
                        sourceClaim: item.sourceClaim || "",
                    });
                    if (decision?.shouldAsk && decision.followUp) item.followUpQuestion = decision.followUp;
                    else await advanceAdaptiveRound({ assessment, attempt, roundIndex, questionIndex });
                } catch { await advanceAdaptiveRound({ assessment, attempt, roundIndex, questionIndex }); }
            } else if (item.answer && !assessment.followUpsEnabled) {
                await advanceAdaptiveRound({ assessment, attempt, roundIndex, questionIndex });
            }
        } else if (assessment.followUpsEnabled && item.answer && !item.followUpQuestion) {
            try {
                const decision = await generateFollowUp({ questionText: item.text, userAnswer: combinedAnswer(item), jobRole: assessment.jobRole, roundName: round.name, systemDesign: round.deliveryMode === "system-design", competencies: item.competencies || [] });
                item.followUpQuestion = decision?.shouldAsk ? decision.followUp || "" : "";
            } catch { /* save the original response even if follow-up generation fails */ }
        }

        await attempt.save();
        return res.json({ attempt: publicAttempt(attempt) });
    } catch (error) { return next(error); }
};
