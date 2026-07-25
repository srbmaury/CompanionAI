import { Route, Routes, Navigate } from "react-router-dom";
import { useState } from "react";

import Header from "./components/Header";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";

import CreateInterviewPage from "./pages/CreateInterviewPage";
import DashboardPage from "./pages/DashboardPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import InterviewPage from "./pages/InterviewPage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import RegisterPage from "./pages/RegisterPage";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";
import VerifyEmailPage from "./pages/VerifyEmailPage.jsx";
import ExperiencesPage from "./pages/ExperiencesPage.jsx";
import ResumeReviewPage from "./pages/ResumeReviewPage.jsx";

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
                <Routes>
                {/* Public routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

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
                {/* For any invalid url redirect to login */}
                <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
                </ErrorBoundary>
            </main>
        </div>
    );
}

export default App;
