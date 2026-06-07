const isBrowser = typeof window !== "undefined";

export const storage = {
    get(key) {
        try {
            const raw = isBrowser ? window.localStorage.getItem(key) : null;
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    },
    set(key, value) {
        try { if (isBrowser) window.localStorage.setItem(key, JSON.stringify(value)); } catch { void 0; }
    },
    remove(key) {
        try { if (isBrowser) window.localStorage.removeItem(key); } catch { void 0; }
    },
};

export const storageKeys = {
    conv: (iid, rid, idx) => `ia:conv:${iid}:${rid}:${idx}`,
    oa:   (iid, rid)       => `ia:oa:${iid}:${rid}`,
    selRound: (iid)        => `ia:selRound:${iid}`,
};
