import { Route, Routes, Navigate } from "react-router-dom";
import { lazy, Suspense, useState } from "react";
import { Box, CircularProgress } from "@mui/material";

import Header from "./components/Header";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import AdminRoute from "./components/AdminRoute";

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
const LandingPage = lazy(() => import("./pages/LandingPage.jsx"));
const LegalPage = lazy(() => import("./pages/LegalPage.jsx"));
const ProgressPage = lazy(() => import("./pages/ProgressPage.jsx"));
const ReviewHistoryPage = lazy(() => import("./pages/ReviewHistoryPage.jsx"));
const SavedExperiencesPage = lazy(() => import("./pages/SavedExperiencesPage.jsx"));
const ResumesPage = lazy(() => import("./pages/ResumesPage.jsx"));
const PricingPage = lazy(() => import("./pages/PricingPage.jsx"));
const BillingSuccessPage = lazy(() => import("./pages/BillingSuccessPage.jsx"));
const AdminFeedbackPage = lazy(() => import("./pages/AdminFeedbackPage.jsx"));

const PageLoader = () => (
    <Box sx={{ minHeight: "60vh", display: "grid", placeItems: "center" }} role="status" aria-label="Loading page">
        <CircularProgress />
    </Box>
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
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/privacy" element={<LegalPage type="privacy" />} />
                <Route path="/terms" element={<LegalPage type="terms" />} />

                {/* Protected routes */}
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <DashboardPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/experiences"
                    element={
                        <ProtectedRoute>
                            <ExperiencesPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/profile"
                    element={
                        <ProtectedRoute>
                            <ProfilePage />
                        </ProtectedRoute>
                    }
                />
                <Route path="/progress" element={<ProtectedRoute><ProgressPage /></ProtectedRoute>} />
                <Route path="/resume-reviews" element={<ProtectedRoute><ReviewHistoryPage /></ProtectedRoute>} />
                <Route path="/saved-experiences" element={<ProtectedRoute><SavedExperiencesPage /></ProtectedRoute>} />
                <Route path="/resumes" element={<ProtectedRoute><ResumesPage /></ProtectedRoute>} />
                <Route path="/pricing" element={<ProtectedRoute><PricingPage /></ProtectedRoute>} />
                <Route path="/billing/success" element={<ProtectedRoute><BillingSuccessPage /></ProtectedRoute>} />
                <Route path="/admin/feedback" element={<ProtectedRoute><AdminRoute><AdminFeedbackPage /></AdminRoute></ProtectedRoute>} />
                <Route
                    path="/create-interview"
                    element={
                        <ProtectedRoute>
                            <CreateInterviewPage />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/resume-review"
                    element={
                        <ProtectedRoute>
                            <ResumeReviewPage />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/interviews/:interviewId"
                    element={
                        <ProtectedRoute>
                            <InterviewPage />
                        </ProtectedRoute>
                    }
                />
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
