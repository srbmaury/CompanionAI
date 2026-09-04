import { Route, Routes, Navigate } from "react-router-dom";
import { lazy, Suspense, useState } from "react";
import { Box, CircularProgress } from "@mui/material";

import Header from "./components/Header";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import AdminRoute from "./components/AdminRoute";
import GuestOnlyRoute from "./components/GuestOnlyRoute";
import HiringOrganizationGate from "./components/HiringOrganizationGate";
import SearchIndexPolicy from "./components/SearchIndexPolicy";

const CreateInterviewPage = lazy(() => import("./pages/CreateInterviewPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage.jsx"));
const InterviewPage = lazy(() => import("./pages/InterviewPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage.jsx"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage.jsx"));
const ExperiencesPage = lazy(() => import("./pages/ExperiencesPage.jsx"));
const ResumeReviewPage = lazy(() => import("./pages/ResumeReviewPage.jsx"));
const ResumeMatcherPage = lazy(() => import("./pages/ResumeMatcherPage.jsx"));
const LandingPage = lazy(() => import("./pages/LandingPage.jsx"));
const LegalPage = lazy(() => import("./pages/LegalPage.jsx"));
const ProgressPage = lazy(() => import("./pages/ProgressPage.jsx"));
const ReviewHistoryPage = lazy(() => import("./pages/ReviewHistoryPage.jsx"));
const SavedExperiencesPage = lazy(() => import("./pages/SavedExperiencesPage.jsx"));
const ResumesPage = lazy(() => import("./pages/ResumesPage.jsx"));
const PricingPage = lazy(() => import("./pages/PricingPage.jsx"));
const BillingSuccessPage = lazy(() => import("./pages/BillingSuccessPage.jsx"));
const AdminFeedbackPage = lazy(() => import("./pages/AdminFeedbackPage.jsx"));
const AdminAuditPage = lazy(() => import("./pages/AdminAuditPage.jsx"));
const AssessmentsPage = lazy(() => import("./pages/AssessmentsPage.jsx"));
const AssessmentReportPage = lazy(() => import("./pages/AssessmentReportPage.jsx"));
const CandidateAssessmentPage = lazy(() => import("./pages/CandidateAssessmentPage.jsx"));
const AssessmentPreviewPage = lazy(() => import("./pages/AssessmentPreviewPage.jsx"));
const HiringTeamPage = lazy(() => import("./pages/HiringTeamPage.jsx"));
const SsoCallbackPage = lazy(() => import("./pages/SsoCallbackPage.jsx"));
const SsoSettingsPage = lazy(() => import("./pages/SsoSettingsPage.jsx"));
const PublicDocsPage = lazy(() => import("./pages/PublicDocsPage.jsx"));

const PageLoader = () => (
    <Box sx={{ minHeight: "60vh", display: "grid", placeItems: "center" }} role="status" aria-label="Loading page">
        <CircularProgress />
    </Box>
);

const HiringRoute = ({ children }) => (
    <ProtectedRoute>
        <HiringOrganizationGate>{children}</HiringOrganizationGate>
    </ProtectedRoute>
);

function App() {
    const [showSkip, setShowSkip] = useState(false);
    const hiddenStyle = {
        position: "absolute",
        left: "-10000px",
        top: "auto",
        width: 1,
        height: 1,
        overflow: "hidden",
        zIndex: 10000,
    };
    const visibleStyle = {
        position: "absolute",
        left: 8,
        top: 8,
        background: "#fff",
        color: "#000",
        padding: "8px 12px",
        borderRadius: 4,
        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
        zIndex: 10000,
    };
    return (
        <div className="min-h-screen">
            <SearchIndexPolicy />
            <a
                href="#main-content"
                onFocus={() => setShowSkip(true)}
                onBlur={() => setShowSkip(false)}
                style={showSkip ? visibleStyle : hiddenStyle}
            >
                Skip to main content
            </a>
            <Header />
            <main id="main-content">
                <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                <Routes>
                {/* Public routes */}
                <Route path="/" element={<GuestOnlyRoute><LandingPage /></GuestOnlyRoute>} />
                <Route path="/login" element={<GuestOnlyRoute><LoginPage /></GuestOnlyRoute>} />
                <Route path="/register" element={<GuestOnlyRoute><RegisterPage /></GuestOnlyRoute>} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/sso/callback" element={<SsoCallbackPage />} />
                <Route path="/privacy" element={<LegalPage type="privacy" />} />
                <Route path="/terms" element={<LegalPage type="terms" />} />
                <Route path="/docs" element={<PublicDocsPage />} />
                <Route path="/docs/*" element={<PublicDocsPage />} />
                <Route path="/assessment/:shareToken" element={<CandidateAssessmentPage />} />

                {/* Protected routes */}
                <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                <Route path="/experiences" element={<ProtectedRoute><ExperiencesPage /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/progress" element={<ProtectedRoute><ProgressPage /></ProtectedRoute>} />
                <Route path="/resume-reviews" element={<ProtectedRoute><ReviewHistoryPage /></ProtectedRoute>} />
                <Route path="/resume-match" element={<ProtectedRoute><ResumeMatcherPage /></ProtectedRoute>} />
                <Route path="/saved-experiences" element={<ProtectedRoute><SavedExperiencesPage /></ProtectedRoute>} />
                <Route path="/resumes" element={<ProtectedRoute><ResumesPage /></ProtectedRoute>} />
                <Route path="/pricing" element={<ProtectedRoute><PricingPage /></ProtectedRoute>} />
                <Route path="/billing/success" element={<ProtectedRoute><BillingSuccessPage /></ProtectedRoute>} />
                <Route path="/admin/feedback" element={<ProtectedRoute><AdminRoute><AdminFeedbackPage /></AdminRoute></ProtectedRoute>} />
                <Route path="/admin/audit" element={<ProtectedRoute><AdminRoute><AdminAuditPage /></AdminRoute></ProtectedRoute>} />
                <Route path="/assessments" element={<HiringRoute><AssessmentsPage /></HiringRoute>} />
                <Route path="/assessments/:assessmentId" element={<HiringRoute><AssessmentReportPage /></HiringRoute>} />
                <Route path="/assessments/:assessmentId/preview" element={<HiringRoute><AssessmentPreviewPage /></HiringRoute>} />
                <Route path="/hiring/team" element={<HiringRoute><HiringTeamPage /></HiringRoute>} />
                <Route path="/hiring/sso" element={<HiringRoute><SsoSettingsPage /></HiringRoute>} />
                <Route path="/create-interview" element={<ProtectedRoute><CreateInterviewPage /></ProtectedRoute>} />
                <Route path="/resume-review" element={<ProtectedRoute><ResumeReviewPage /></ProtectedRoute>} />
                <Route path="/interviews/:interviewId" element={<ProtectedRoute><InterviewPage /></ProtectedRoute>} />

                {/* For any invalid url return to the product home */}
                <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                </Suspense>
                </ErrorBoundary>
            </main>
        </div>
    );
}

export default App;