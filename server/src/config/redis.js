import { createClient } from "redis";

let client = null;
let initializing = false;
let policyChecked = false;

const ensureNoEvictionPolicy = async (c) => {
    if (!c || policyChecked) return;
    try {
        // CONFIG GET returns [key, value]
        const res = await c.sendCommand(["CONFIG", "GET", "maxmemory-policy"]);
        const current = Array.isArray(res) ? (res[1] || "").toString().toLowerCase() : "";
        if (current && current !== "noeviction") {
            try {
                await c.sendCommand(["CONFIG", "SET", "maxmemory-policy", "noeviction"]);
                console.log("[Redis] maxmemory-policy set to noeviction (was:", current, ")");
            } catch (e) {
                console.warn("[Redis] Unable to set maxmemory-policy to noeviction:", e?.message || e);
            }
        }
    } catch (e) {
        // CONFIG may be disabled on managed services; log and continue
        console.warn("[Redis] Could not verify eviction policy:", e?.message || e);
    } finally {
        policyChecked = true;
    }
};

export const getRedisClient = async () => {
    try {
        if (client && client.isOpen) return client;
        const url = process.env.REDIS_URL;
        if (!url) return null;
        if (!client) {
            const connectTimeoutMs = Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 15000);
            const retryBaseMs = Number(process.env.REDIS_RETRY_BASE_MS || 500);
            const retryMaxMs = Number(process.env.REDIS_RETRY_MAX_MS || 30000);
            client = createClient({
                url,
                socket: {
                    connectTimeout: connectTimeoutMs,
                    reconnectStrategy: (retries) => {
                        try {
                            const delay = Math.min(retryBaseMs * Math.pow(2, retries), retryMaxMs);
                            return delay;
                        } catch {
                            return retryBaseMs;
                        }
                    },
                },
            });
            client.on("error", (err) => {
                console.warn("Redis client error:", err?.message || err);
            });
        }
        if (!client.isOpen && !initializing) {
            initializing = true;
            try {
                await client.connect();
                // Best-effort: enforce noeviction policy for reliability
                await ensureNoEvictionPolicy(client);
            } finally {
                initializing = false;
            }
        }
        // If connection is already open and policy not checked (e.g., hot path), check once
        if (client.isOpen) await ensureNoEvictionPolicy(client);
        return client.isOpen ? client : null;
    } catch (e) {
        return null;
    }
};

export default getRedisClient;
