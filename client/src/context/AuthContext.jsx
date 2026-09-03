/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useEffect, useState } from "react";

import api, { clearAccessToken, setAccessToken, silentRefresh } from "../api/axios";
import { adoptGuestWorkspacePreference } from "../utils/workspacePreference";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = useCallback(async () => {
        try {
            const { data } = await api.get(`/auth/profile`);
            adoptGuestWorkspacePreference(data?._id);
            setUser(data);
            return data;
        } catch {
            setUser(null);
            return null;
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                await silentRefresh();
                await fetchProfile();
            } catch { setUser(null); }
            setLoading(false);
        };
        init();
    }, [fetchProfile]);

    const login = async (email, password, captchaToken) => {
        const payload = { email, password };
        if (captchaToken) payload.captchaToken = captchaToken;
        const { data } = await api.post(`/auth/login`, payload);
        if (data?.token) setAccessToken(data.token);
        return fetchProfile();
    };

    const register = async (name, email, password, captchaToken) => {
        const payload = { name, email, password };
        if (captchaToken) payload.captchaToken = captchaToken;
        const { data } = await api.post(`/auth/register`, payload);
        return data;
    };

    const googleLogin = async (idToken) => {
        const { data } = await api.post(`/auth/google`, { idToken });
        if (data?.token) setAccessToken(data.token);
        return fetchProfile();
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
        clearAccessToken();
        setUser(null);
    };

    const updateProfile = async (updates) => {
        const { data } = await api.put(`/auth/profile`, updates);
        if (data?.token) setAccessToken(data.token);
        if (data?.user) setUser(data.user);
        return data;
    };

    const deleteAccount = async ({ confirmation, password }) => {
        const { data } = await api.delete(`/auth/profile`, { data: { confirmation, password } });
        clearAccessToken();
        setUser(null);
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
                deleteAccount,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
