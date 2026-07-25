import api from "../api/axios";

export const useResumes = () => {
    const getResumes = async (opts = {}) => {
        const params = new URLSearchParams();
        if (opts.sort) params.set("sort", opts.sort);
        if (opts.tag) params.set("tag", opts.tag);
        if (opts.q) params.set("q", opts.q);
        const qs = params.toString();
        const { data } = await api.get(`/resumes${qs ? `?${qs}` : ""}`);
        return Array.isArray(data) ? data : [];
    };

    const uploadResume = async (file) => {
        const form = new FormData();
        form.append("resume", file);
        const { data } = await api.post(`/resumes`, form, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return data;
    };

    const deleteResume = async (id) => {
        await api.delete(`/resumes/${id}`);
    };

    const updateResume = async (id, payload) => {
        const { data } = await api.put(`/resumes/${id}`, payload);
        return data;
    };

    return { getResumes, uploadResume, deleteResume, updateResume };
};
