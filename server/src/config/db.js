import mongoose from "mongoose";
import productionMetrics from "../metrics/production.js";

let poolMetricsBound = false;

const bindPoolMetrics = (mongoClient) => {
    if (!mongoClient || poolMetricsBound || typeof mongoClient.on !== "function") return;
    poolMetricsBound = true;
    let checkedOut = 0;
    let waiting = 0;

    const syncPoolGauges = () => {
        productionMetrics.mongoPoolConnections.labels("checked_out").set(Math.max(0, checkedOut));
        productionMetrics.mongoPoolWaitQueue.set(Math.max(0, waiting));
    };
    syncPoolGauges();

    mongoClient.on("connectionCheckOutStarted", () => {
        waiting += 1;
        syncPoolGauges();
    });
    mongoClient.on("connectionCheckedOut", () => {
        waiting = Math.max(0, waiting - 1);
        checkedOut += 1;
        syncPoolGauges();
    });
    mongoClient.on("connectionCheckOutFailed", () => {
        waiting = Math.max(0, waiting - 1);
        productionMetrics.mongoPoolCheckoutFailuresTotal.inc();
        syncPoolGauges();
    });
    mongoClient.on("connectionCheckedIn", () => {
        checkedOut = Math.max(0, checkedOut - 1);
        syncPoolGauges();
    });
    const resetPoolGauges = () => {
        waiting = 0;
        checkedOut = 0;
        syncPoolGauges();
    };
    mongoClient.on("connectionPoolCleared", resetPoolGauges);
    mongoClient.on("topologyClosed", resetPoolGauges);
};

export const mongoTopologyKind = (hello = {}) => {
    if (hello?.msg === "isdbgrid") return "sharded";
    if (hello?.setName) return "replica-set";
    return "standalone";
};

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            ssl: process.env.MONGO_TLS === "true" ? true : undefined,
            sslValidate: process.env.MONGO_TLS_VALIDATE === "false" ? false : undefined,
        });
        console.log(`✅ MongoDB connected: ${conn.connection.host}`);
        bindPoolMetrics(mongoose.connection.getClient?.());
        await verifyTransactionsSupport();
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
};

export const verifyTransactionsSupport = async () => {
    const requireTx = process.env.MONGO_REQUIRE_TRANSACTIONS === "false" ? false : (process.env.NODE_ENV === "production");
    try {
        const admin = mongoose.connection.db.admin();
        const hello = await admin.command({ hello: 1 }).catch(() => admin.command({ ismaster: 1 }));
        const topology = mongoTopologyKind(hello);
        if (topology === "standalone") {
            console.warn("⚠️ MongoDB topology appears standalone; verifying transaction support directly.");
        }

        // A real read inside a transaction is a stronger capability check than
        // topology-name heuristics and works for both replica sets and mongos.
        const session = await mongoose.startSession();
        try {
            session.startTransaction();
            await mongoose.connection.db.collection("users").findOne({}, { session, projection: { _id: 1 } });
            await session.abortTransaction();
            console.log(`✅ MongoDB transactions supported (${topology})`);
        } finally {
            await session.endSession();
        }
    } catch (e) {
        console.warn("⚠️ Transaction capability check failed:", e?.message || e);
        if (requireTx) {
            console.error("❌ Transactions required but unavailable. Exiting.");
            process.exit(1);
        }
    }
};

export default connectDB;
