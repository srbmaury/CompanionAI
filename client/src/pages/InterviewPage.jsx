import { useCallback, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { useInterviewSession } from "../hooks/useInterviewSession";
import { useConversational }   from "../hooks/useConversational";
import { useOAForm }           from "../hooks/useOAForm";
import { useVoiceInput }       from "../hooks/useVoiceInput";
import { useResumePdf }        from "../hooks/useResumePdf";

import { Alert, Box, Button, Chip, CircularProgress, Divider, Drawer, IconButton, LinearProgress, Link, Stack, Typography,
         Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import HelpPopover   from "../components/HelpPopover";

import ConversationalPanel from "../components/ConversationalPanel";
import FeedbackPanel       from "../components/FeedbackPanel";
import OAForm              from "../components/OAForm";
import RoundList           from "../components/RoundList";

const outlinedInputSx = {
    "& .MuiOutlinedInput-root": {
        "& fieldset": { borderColor: "#c4c4c4" },
        "&:hover fieldset": { borderColor: "#1976d2" },
        "&.Mui-focused fieldset": { borderColor: "#1976d2", borderWidth: 2 },
    },
};

const InterviewPage = () => {
    const { interviewId } = useParams();

    // ── Toast ─────────────────────────────────────────────────────────────────
    const [inlineStatus, setInlineStatus] = useState({ open: false, severity: "info", message: "" });
    const showToast = useCallback((severity, message, persistent = false) => {
        setInlineStatus({ open: true, severity, message });
        if (!persistent && severity !== "error") {
            setTimeout(() => setInlineStatus((s) => ({ ...s, open: false })), 4000);
        }
    }, []);

    // ── UI toggles ────────────────────────────────────────────────────────────
    const [roundsOpen, setRoundsOpen] = useState(false);
    const [resumeOpen, setResumeOpen] = useState(false);

    // ── Session ───────────────────────────────────────────────────────────────
    const {
        interview, setInterview,
        selectedRound, setSelectedRound, selectRound,
        roundLocked,
        loadingRound, roundPrepareProgress,
        prepError, retryPrep,
        allRoundsCompleted,
        clearDraftsForRound, handleSkipRound,
    } = useInterviewSession(interviewId, showToast);

    const isConversational = useMemo(
        () => selectedRound?.deliveryMode === "conversational",
        [selectedRound]
    );

    const hasAnsweredMissingFeedback = useMemo(() => {
        const qList = selectedRound?.questions || [];
        return qList.some((q) => (q?.answerGiven || "").toString().trim() && !q?.feedback);
    }, [selectedRound?.questions]);

    // ── Voice transcript routing (via refs to avoid circular hook ordering) ───
    // Refs are updated after each render, so onTranscript always calls the latest setters.
    const convAnswerSetterRef = useRef(null);
    const oaAnswersSetterRef  = useRef(null);

    const onTranscript = useCallback((target, text) => {
        if (target === "conv") {
            convAnswerSetterRef.current?.((prev) => (prev ? prev + " " : "") + text);
        } else if (typeof target === "number") {
            oaAnswersSetterRef.current?.((prev) => {
                const next = [...prev];
                next[target] = ((next[target] || "") + " " + text).trimStart();
                return next;
            });
        }
    }, []);

    // ── Voice input ───────────────────────────────────────────────────────────
    const {
        listening, listeningTarget, interimText,
        micLevel, micPermission,
        inputDevices, selectedDeviceId, setSelectedDeviceId,
        supportsSTT, supportsTTS,
        startListening, stopListening, speakNow,
    } = useVoiceInput({ onTranscript });

    // ── Conversational ────────────────────────────────────────────────────────
    const {
        convViewState,
        convAnswer, setConvAnswer,
        convSavedAt,
        convSubmitting, convRoundSubmitting, convFeedbackProgress,
        pendingFollowUp,
        handleSubmitAnswer, handleFollowUpDone, handleClarify, handleCompleteRound,
    } = useConversational({
        interviewId, selectedRound, isConversational,
        setSelectedRound, selectRound, setInterview,
        showToast, clearDraftsForRound,
    });
    convAnswerSetterRef.current = setConvAnswer;

    // ── OA Form ───────────────────────────────────────────────────────────────
    const {
        oaAnswers, setOaAnswers,
        oaSubmitting, oaFeedbackProgress,
        handleOAChange, handleOASubmit,
    } = useOAForm({
        interviewId, selectedRound, isConversational, roundLocked,
        selectRound, setInterview,
        showToast, clearDraftsForRound,
    });
    oaAnswersSetterRef.current = setOaAnswers;

    // ── Resume preview ────────────────────────────────────────────────────────
    const resumeUrl         = interview?.resume?.fileUrl  || "";
    const resumeFileType    = interview?.resume?.fileType || "";
    const resumePreviewPath = interview?.resume?._id ? `/resumes/${interview.resume._id}/preview` : "";
    const resumeBlobUrl = useResumePdf({ resumeOpen, resumePreviewPath, resumeFileType });

    // ── Shared voice prop bundle ──────────────────────────────────────────────
    const voiceProps = useMemo(() => ({
        supportsTTS, supportsSTT,
        listening, listeningTarget, interimText,
        onSpeak: speakNow,
        onStartListening: startListening,
        onStopListening: stopListening,
        micPermission, micLevel,
        inputDevices, selectedDeviceId,
        onChangeDevice: setSelectedDeviceId,
        pushToTalk: false,
        outlinedInputSx,
    }), [supportsTTS, supportsSTT, listening, listeningTarget, interimText, speakNow, startListening,
        stopListening, micPermission, micLevel, inputDevices, selectedDeviceId, setSelectedDeviceId]);

    if (!interview) return (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
            <CircularProgress />
        </Box>
    );

    return (
        <>
            <Box sx={{ display: "flex", gap: 3, p: { xs: 2, md: 3 }, flexDirection: { xs: "column", md: "row" } }}>
                {/* Left: Rounds sidebar */}
                <Box sx={{ width: { xs: "100%", md: 250 }, flexShrink: 0 }}>
                    <Box sx={{ display: { xs: "flex", md: "none" }, mb: 1, justifyContent: "space-between", alignItems: "center" }}>
                        <Typography variant="h6">Rounds</Typography>
                        <IconButton onClick={() => setRoundsOpen(true)} aria-label="open rounds">
                            <MenuIcon />
                        </IconButton>
                    </Box>
                    <RoundList interview={interview} selectedRoundId={selectedRound?._id} onSelect={selectRound} />
                    <Drawer anchor="left" open={roundsOpen} onClose={() => setRoundsOpen(false)} sx={{ display: { md: "none" } }}>
                        <Box sx={{ width: 300, p: 2 }} role="presentation">
                            <Typography variant="h6" sx={{ mb: 1 }}>Rounds</Typography>
                            <Divider sx={{ mb: 2 }} />
                            <RoundList
                                interview={interview}
                                selectedRoundId={selectedRound?._id}
                                onSelect={(r) => { selectRound(r); setRoundsOpen(false); }}
                                showOnMobile
                            />
                        </Box>
                    </Drawer>
                </Box>

                {/* Right: Active round */}
                <Box sx={{ flexGrow: 1 }}>
                    {inlineStatus.open && (
                        <Alert
                            severity={inlineStatus.severity}
                            aria-live={inlineStatus.severity === "error" ? undefined : "polite"}
                            role={inlineStatus.severity === "error" ? "alert" : undefined}
                            sx={{ mb: 2 }}
                            onClose={() => setInlineStatus((s) => ({ ...s, open: false }))}
                        >
                            {inlineStatus.message}
                        </Alert>
                    )}

                    <Alert severity={interview?.grounding?.status === "grounded" ? "success" : "info"} sx={{ mb: 2 }}>
                        {interview?.grounding?.status === "grounded"
                            ? `Grounded in ${interview.grounding.sources?.length || 0} public experience source${interview.grounding.sources?.length === 1 ? "" : "s"}; questions also use your JD and resume.`
                            : "AI simulation: limited public company-specific evidence was available, so questions rely on the JD, role, and resume."}
                        {(interview?.grounding?.sources || []).slice(0, 3).map((source) => (
                            <Link key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" sx={{ ml: 1 }}>
                                {source.title}
                            </Link>
                        ))}
                    </Alert>

                    {!selectedRound ? (
                        <Typography>Select a round to view details</Typography>
                    ) : (
                        <>
                            {/* Round header */}
                            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={1} sx={{ mb: 2 }}>
                                <Stack>
                                    <Typography variant="h5" gutterBottom>{selectedRound.name}</Typography>
                                    <Typography variant="body1" gutterBottom>{selectedRound.description}</Typography>
                                </Stack>
                                <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "center" }} sx={{ mb: { xs: 2, md: 0 } }}>
                                    {allRoundsCompleted && Number.isFinite(Number(interview?.overallScore)) && (
                                        <Chip color="primary" label={`Overall Score: ${interview.overallScore}/10`} />
                                    )}
                                    {resumeUrl && (
                                        <Button
                                            variant="outlined"
                                            onClick={() => { if (resumeFileType === "application/pdf") setResumeOpen(true); else window.open(resumeUrl, "_blank"); }}
                                            sx={{ mb: { xs: 2, md: 0 } }}
                                        >
                                            View Resume
                                        </Button>
                                    )}
                                </Stack>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <HelpPopover />
                                </Stack>
                            </Stack>

                            {/* Round body */}
                            {loadingRound ? (
                                <Stack spacing={1} sx={{ py: 2 }}>
                                    <Typography>
                                        Preparing questions{roundPrepareProgress ? `… ${Math.min(100, Math.max(0, Math.round(roundPrepareProgress)))}%` : "..."}
                                    </Typography>
                                    <LinearProgress
                                        variant={roundPrepareProgress ? "determinate" : "indeterminate"}
                                        value={Math.min(100, Math.max(0, roundPrepareProgress || 0))}
                                    />
                                </Stack>
                            ) : prepError ? (
                                <Stack spacing={1}>
                                    <Alert severity="error">{prepError}</Alert>
                                    <Button variant="outlined" onClick={retryPrep}>Retry</Button>
                                </Stack>
                            ) : isConversational ? (
                                selectedRound.status === "completed" ? (
                                    (convRoundSubmitting || hasAnsweredMissingFeedback) ? (
                                        <Stack spacing={1} sx={{ py: 2 }}>
                                            <Typography>
                                                Generating feedback… {convFeedbackProgress ? `${Math.round(convFeedbackProgress)}%` : ""}
                                            </Typography>
                                            <LinearProgress
                                                variant={convFeedbackProgress ? "determinate" : "indeterminate"}
                                                value={convFeedbackProgress || 0}
                                            />
                                        </Stack>
                                    ) : (
                                        <FeedbackPanel round={selectedRound} />
                                    )
                                ) : (
                                    <>
                                        <ConversationalPanel
                                            convSubmitting={convSubmitting}
                                            convRoundSubmitting={convRoundSubmitting}
                                            convState={convViewState}
                                            convAnswer={convAnswer}
                                            setConvAnswer={setConvAnswer}
                                            onSubmitAnswer={handleSubmitAnswer}
                                            onClarify={handleClarify}
                                            onCompleteRound={handleCompleteRound}
                                            onSkip={handleSkipRound}
                                            savedAt={convSavedAt}
                                            target="conv"
                                            pendingFollowUp={pendingFollowUp}
                                            onFollowUpDone={handleFollowUpDone}
                                            {...voiceProps}
                                        />
                                        {convRoundSubmitting && (
                                            <Stack spacing={0.5} sx={{ mt: 1 }}>
                                                <Typography>
                                                    Generating feedback… {convFeedbackProgress ? `${Math.round(convFeedbackProgress)}%` : ""}
                                                </Typography>
                                                <LinearProgress
                                                    variant={convFeedbackProgress ? "determinate" : "indeterminate"}
                                                    value={convFeedbackProgress || 0}
                                                />
                                            </Stack>
                                        )}
                                    </>
                                )
                            ) : (
                                selectedRound.status === "completed" ? (
                                    hasAnsweredMissingFeedback ? (
                                        <Stack spacing={1} sx={{ py: 2 }}>
                                            <Typography>
                                                Generating feedback… {oaFeedbackProgress ? `${Math.round(oaFeedbackProgress)}%` : ""}
                                            </Typography>
                                            <LinearProgress
                                                variant={oaFeedbackProgress ? "determinate" : "indeterminate"}
                                                value={oaFeedbackProgress || 0}
                                            />
                                        </Stack>
                                    ) : (
                                        <FeedbackPanel round={selectedRound} />
                                    )
                                ) : (
                                    <>
                                        <OAForm
                                            questions={selectedRound.questions}
                                            answers={oaAnswers}
                                            onChange={handleOAChange}
                                            onSubmit={handleOASubmit}
                                            onSkip={handleSkipRound}
                                            submitting={oaSubmitting}
                                            {...voiceProps}
                                        />
                                        {oaSubmitting && (
                                            <Stack spacing={0.5} sx={{ mt: 1 }}>
                                                <Typography>
                                                    Generating feedback… {oaFeedbackProgress ? `${Math.round(oaFeedbackProgress)}%` : ""}
                                                </Typography>
                                                <LinearProgress
                                                    variant={oaFeedbackProgress ? "determinate" : "indeterminate"}
                                                    value={oaFeedbackProgress || 0}
                                                />
                                            </Stack>
                                        )}
                                    </>
                                )
                            )}
                        </>
                    )}
                </Box>
            </Box>


            {/* Resume dialog */}
            <Dialog
                open={resumeOpen}
                onClose={() => setResumeOpen(false)}
                fullWidth maxWidth="xl"
                PaperProps={{ sx: { height: "92vh" } }}
                aria-labelledby="resume-dialog-title"
            >
                <DialogTitle id="resume-dialog-title">Resume</DialogTitle>
                <DialogContent dividers sx={{ p: 0, height: "100%" }}>
                    {resumeFileType === "application/pdf" ? (
                        resumeBlobUrl
                            ? <iframe src={resumeBlobUrl} title="Resume Preview" width="100%" height="100%" style={{ border: 0 }} />
                            : <Box sx={{ p: 2 }}><Typography color="text.secondary">Loading resume…</Typography></Box>
                    ) : (
                        <Box sx={{ p: 2 }}><Typography>Preview available for PDFs only.</Typography></Box>
                    )}
                </DialogContent>
                <DialogActions>
                    {resumeUrl && <Button onClick={() => window.open(resumeUrl, "_blank")}>Download</Button>}
                    <Button onClick={() => setResumeOpen(false)} autoFocus>Close</Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default InterviewPage;
