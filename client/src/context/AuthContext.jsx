/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useEffect, useState } from "react";

import api from "../api/axios";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = useCallback(async () => {
        try {
            const { data } = await api.get(`/auth/profile`);
            setUser(data);
        } catch {
            setUser(null);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                const stored = typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null;
                if (stored) {
                    await fetchProfile();
                } else {
                    setUser(null);
                }
            } catch { setUser(null); }
            setLoading(false);
        };
        init();
    }, [fetchProfile]);

    const setToken = (token) => {
        try { if (token) window.localStorage.setItem("accessToken", token); } catch { /* Storage can be unavailable in privacy mode. */ }
    };
    const clearToken = () => {
        try { window.localStorage.removeItem("accessToken"); } catch { /* Storage can be unavailable in privacy mode. */ }
    };

    const login = async (email, password, captchaToken) => {
        const payload = { email, password };
        if (captchaToken) payload.captchaToken = captchaToken;
        const { data } = await api.post(`/auth/login`, payload);
        if (data?.token) setToken(data.token);
        await fetchProfile();
    };

    const register = async (name, email, password, captchaToken) => {
        const payload = { name, email, password };
        if (captchaToken) payload.captchaToken = captchaToken;
        const { data } = await api.post(`/auth/register`, payload);
        return data;
    };

    const googleLogin = async (idToken) => {
        const { data } = await api.post(`/auth/google`, { idToken });
        if (data?.token) setToken(data.token);
        await fetchProfile();
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
        try { await api.post(`/auth/logout`); } catch { /* ignore */ }
        clearToken();
        setUser(null);
    };

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
                updateProfile,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
