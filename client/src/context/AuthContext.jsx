/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useEffect, useState } from "react";

import api from "../api/axios";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [resumes, setResumes] = useState([]);
    const [activeResumeId, setActiveResumeId] = useState(null);
    const [loading, setLoading] = useState(true);

    // —— helpers
    const fetchProfile = useCallback(async () => {
        try {
            const { data } = await api.get(`/auth/profile`);
            setUser(data);
        } catch {
            setUser(null);
        }
    }, []);

    const loadResumes = useCallback(async (opts = {}) => {
        if (!user) {
            setResumes([]);
            setActiveResumeId(null);
            return;
        }
        try {
            const params = new URLSearchParams();
            if (opts.sort) params.set("sort", opts.sort);
            if (opts.tag) params.set("tag", opts.tag);
            if (opts.q) params.set("q", opts.q);
            const qs = params.toString();
            const { data } = await api.get(`/resumes${qs ? `?${qs}` : ""}`);
            const list = Array.isArray(data) ? data : [];
            setResumes(list);
            if (!activeResumeId && list.length > 0) {
                setActiveResumeId(list[0]._id);
            }
        } catch (err) {
            console.error("Error fetching resumes:", err);
            setResumes([]);
        }
    }, [user, activeResumeId]);

    // —— lifecycle
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                const stored = typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null;
                if (stored) {
                    // token will be attached by axios interceptor
                    await fetchProfile();
                } else {
                    setUser(null);
                }
            } catch { setUser(null); }
            setLoading(false);
        };
        init();
    }, [fetchProfile]);

    useEffect(() => {
        if (user) loadResumes();
    }, [user, loadResumes]);

    // —— auth
    const setToken = (token) => {
        try { if (token) window.localStorage.setItem("accessToken", token); } catch {}
    };
    const clearToken = () => {
        try { window.localStorage.removeItem("accessToken"); } catch {}
    };

    const login = async (email, password, captchaToken) => {
        const payload = { email, password };
        if (captchaToken) payload.captchaToken = captchaToken;
        const { data } = await api.post(`/auth/login`, payload);
        if (data?.token) setToken(data.token);
        await fetchProfile();
        await loadResumes();
    };

    const register = async (name, email, password, captchaToken) => {
        // After registration server returns message; do not auto-login
        const payload = { name, email, password };
        if (captchaToken) payload.captchaToken = captchaToken;
        const { data } = await api.post(`/auth/register`, payload);
        return data;
    };

    const googleLogin = async (idToken) => {
        const { data } = await api.post(`/auth/google`, { idToken });
        if (data?.token) setToken(data.token);
        await fetchProfile();
        await loadResumes();
    };

    const resendVerification = async (email) => {
        const { data } = await api.post(`/auth/resend-verification`, { email });
        return data;
    };

    const forgotPassword = async (email, captchaToken) => {
        const payload = { email };
        if (captchaToken) payload.captchaToken = captchaToken;
        const { data } = await api.post(`/auth/forgot-password`, payload);
        return data;
    };

    const resetPassword = async ({ token, email, newPassword, captchaToken }) => {
        const payload = { token, email, newPassword };
        if (captchaToken) payload.captchaToken = captchaToken;
        const { data } = await api.post(`/auth/reset-password`, payload);
        return data;
    };

    const logout = async () => {
        clearToken();
        setUser(null);
        setResumes([]);
        setActiveResumeId(null);
    };

    // —— resume actions
    const uploadResume = async (file) => {
        const form = new FormData();
        form.append("resume", file);
        const { data } = await api.post(`/resumes`, form, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        setResumes((prev) => [data, ...prev]);
        setActiveResumeId(data._id);
        return data;
    };

    const deleteResume = async (id) => {
        try {
            await api.delete(`/resumes/${id}`);
            setResumes((prev) => prev.filter((r) => r._id !== id));
            setActiveResumeId((prev) => (prev === id ? null : prev));
        } catch (err) {
            console.error("Error deleting resume:", err);
        }
    };

    const setActiveResume = (id) => {
        setActiveResumeId(id);
    };

    const getResumes = async (opts = {}) => {
        const params = new URLSearchParams();
        if (opts.sort) params.set("sort", opts.sort);
        if (opts.tag) params.set("tag", opts.tag);
        if (opts.q) params.set("q", opts.q);
        const qs = params.toString();
        const { data } = await api.get(`/resumes${qs ? `?${qs}` : ""}`);
        return data;
    };

    const updateResume = async (id, payload) => {
        const { data } = await api.put(`/resumes/${id}`, payload);
        setResumes((prev) => prev.map((r) => (r._id === id ? data : r)));
        return data;
    };

    // —— profile update
    const updateProfile = async ({ name, currentPassword, newPassword, preferredProgrammingLanguage }) => {
        const { data } = await api.put(`/auth/profile`, { name, currentPassword, newPassword, preferredProgrammingLanguage });
        if (data?.token) setToken(data.token);
        if (data?.user) setUser(data.user);
        return data;
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                login,
                register,
                googleLogin,
                resendVerification,
                forgotPassword,
                resetPassword,
                logout,
                resumes,
                activeResumeId,
                setActiveResume,
                uploadResume,
                loadResumes,
                getResumes,
                updateResume,
                deleteResume,
                updateProfile,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
