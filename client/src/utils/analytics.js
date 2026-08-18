import api from "../api/axios";

export const trackEvent = (event, path = window.location.pathname) => {
    Promise.resolve(api.post("/events", { event, path })).catch(() => {});
};
