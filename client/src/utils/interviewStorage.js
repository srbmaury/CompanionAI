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
    convVoice: (iid, rid, idx) => `ia:conv-voice:${iid}:${rid}:${idx}`,
    convCoding: (iid, rid, idx) => `ia:conv-coding:${iid}:${rid}:${idx}`,
    oa:   (iid, rid)       => `ia:oa:${iid}:${rid}`,
    oaVoice: (iid, rid)    => `ia:oa-voice:${iid}:${rid}`,
    oaCoding: (iid, rid)   => `ia:oa-coding:${iid}:${rid}`,
    codeEditor: (draftKey) => `ia:code-editor:${draftKey}`,
    selRound: (iid)        => `ia:selRound:${iid}`,
};
