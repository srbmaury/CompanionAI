import { Route, Routes, Navigate } from "react-router-dom";

import Header from "./components/Header";
import ProtectedRoute from "./components/ProtectedRoute";

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
    return (
        <div className="min-h-screen">
            <Header />
            <main className="p-8 max-w-2xl mx-auto">
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
            </main>
        </div>
    );
}

export default App;
