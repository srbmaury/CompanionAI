import mongoose from "mongoose";
import productionMetrics from "../metrics/production.js";

let poolMetricsBound = false;

const bindPoolMetrics = (mongoClient) => {
    if (!mongoClient || poolMetricsBound || typeof mongoClient.on !== "function") return;
    poolMetricsBound = true;
    productionMetrics.mongoPoolConnections.labels("checked_out").set(0);
    productionMetrics.mongoPoolWaitQueue.set(0);

    mongoClient.on("connectionCheckOutStarted", () => {
        productionMetrics.mongoPoolWaitQueue.inc();
    });
    mongoClient.on("connectionCheckedOut", () => {
        productionMetrics.mongoPoolWaitQueue.dec();
        productionMetrics.mongoPoolConnections.labels("checked_out").inc();
    });
    mongoClient.on("connectionCheckOutFailed", () => {
        productionMetrics.mongoPoolWaitQueue.dec();
        productionMetrics.mongoPoolCheckoutFailuresTotal.inc();
    });
    mongoClient.on("connectionCheckedIn", () => {
        productionMetrics.mongoPoolConnections.labels("checked_out").dec();
    });
    mongoClient.on("connectionPoolCleared", () => {
        productionMetrics.mongoPoolWaitQueue.set(0);
        productionMetrics.mongoPoolConnections.labels("checked_out").set(0);
    });
    mongoClient.on("topologyClosed", () => {
        productionMetrics.mongoPoolWaitQueue.set(0);
        productionMetrics.mongoPoolConnections.labels("checked_out").set(0);
    });
};

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            // Enforce TLS if URI includes ssl=true or when MONGO_TLS=true
            ssl: process.env.MONGO_TLS === "true" ? true : undefined,
            // Validate server cert when CA provided
            sslValidate: process.env.MONGO_TLS_VALIDATE === "false" ? false : undefined,
        });
        console.log(`✅ MongoDB connected: ${conn.connection.host}`);
        bindPoolMetrics(mongoose.connection.getClient?.());

        // Verify that transactions are supported (requires replica set or sharded cluster)
        await verifyTransactionsSupport();
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
};

const verifyTransactionsSupport = async () => {
    const requireTx = process.env.MONGO_REQUIRE_TRANSACTIONS === "false" ? false : (process.env.NODE_ENV === "production");
    try {
        // Check topology metadata first
        const admin = mongoose.connection.db.admin();
        const hello = await admin.command({ hello: 1 }).catch(() => admin.command({ ismaster: 1 }));
        const setName = hello?.setName || hello?.logicalSessionTimeoutMinutes || hello?.arbiterOnly ? hello?.setName : null;
        if (!setName && requireTx) {
            console.error("❌ MongoDB is not running as a replica set. Transactions will not work.");
            console.error("   Configure a replica set (e.g., Atlas or single-node RS) or set MONGO_REQUIRE_TRANSACTIONS=false to bypass.");
            process.exit(1);
            return;
        }

        // Try a lightweight transaction round-trip
        const session = await mongoose.startSession();
        try {
            session.startTransaction();
            // No-op read during transaction
            await mongoose.connection.db.command({ ping: 1 }, { session });
            await session.abortTransaction();
            console.log("✅ MongoDB transactions supported");
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
