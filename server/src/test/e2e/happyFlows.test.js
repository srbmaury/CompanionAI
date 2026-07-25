import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import app from "../../app.js";
import User from "../../models/User.js";
import Resume from "../../models/Resume.js";
import Question from "../../models/Question.js";
import connectDB from "../../config/db.js";

let replset;
let agent;
let accessToken;

describe("Happy flows E2E", () => {
    beforeAll(async () => {
        replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
        const uri = replset.getUri();
        process.env.MONGO_URI = uri;
        process.env.NODE_ENV = "test";
        process.env.MONGO_TLS = "false";
        process.env.MONGO_REQUIRE_TRANSACTIONS = "false";
        process.env.TEST_FORCE_GENERATOR_EMPTY = "true";
        await connectDB();
        agent = request.agent(app);
    }, 60000);

    afterAll(async () => {
        try { await mongoose.connection.close(); } catch {}
        if (replset) await replset.stop();
    }, 30000);

    it("registers, logs in, uploads resume, creates interview, prepares first round", async () => {
        const origin = "http://localhost:5000";

        // Register
        const reg = await agent
            .post("/api/auth/register")
            .send({ name: "Test User", email: "t@example.com", password: "Passw0rd!" })
            .set("origin", origin)
            .set("referer", `${origin}/`)
            .expect(201);
        expect(reg.body?.message).toMatch(/verify/i);

        // Mark user verified for test login
        const u = await User.findOne({ email: "t@example.com" });
        u.isVerified = true;
        await u.save();

        // Login
        const login = await agent
            .post("/api/auth/login")
            .send({ email: "t@example.com", password: "Passw0rd!" })
            .set("origin", origin)
            .set("referer", `${origin}/`)
            .expect(200);
        accessToken = login.body?.token;
        expect(accessToken).toBeDefined();

        const auth = { Authorization: `Bearer ${accessToken}` };

        // Create minimal resume directly via model (avoids Cloudinary)
        const me = await User.findOne({ email: "t@example.com" });
        const resumeDoc = await Resume.create({
            user: me._id,
            fileUrl: "http://localhost/resumes/test.pdf",
            publicId: "resumes/test",
            fileName: "test.pdf",
            fileType: "application/pdf",
            fileSize: 1234,
            extractedText: "Sample resume text for testing. Skills: JavaScript, Node.js",
            tags: ["test"],
            notes: "",
        });
        const resumeId = resumeDoc._id.toHexString();

        // Create interview with 2 rounds
        const create = await agent
            .post("/api/interviews")
            .set(auth)
            .set("origin", origin)
            .set("referer", `${origin}/`)
            .send({
                resumeId,
                company: "Acme",
                jobRole: "Software Engineer",
                jobDescription: "Build things",
                rounds: [
                    { roundName: "Round 1", description: "Conversational", deliveryMode: "conversational", questionLimit: 2 },
                    { roundName: "Round 2", description: "OA", deliveryMode: "online-assessment", questionLimit: 2 },
                ],
            });
        if (create.status !== 201) {
            console.error("CreateInterview failed:", create.status, create.body);
        }
        expect(create.status).toBe(201);
        expect(create.body?._id).toBeDefined();
        const interviewId = create.body._id;

        // Fetch interview
        const fetched = await agent.get(`/api/interviews/${interviewId}`).set(auth).expect(200);
        expect(Array.isArray(fetched.body?.rounds)).toBe(true);
        const firstRoundId = fetched.body.rounds[0].round._id;

        // Seed generic questions for fallback
        await Question.create([
            { text: "Explain event loop in Node.js", tags: ["node", "event loop"] },
            { text: "What is closure in JavaScript?", tags: ["javascript"] },
            { text: "Describe REST vs GraphQL", tags: ["api"] },
        ]);

        // Prepare first round
        const prep = await agent
            .post(`/api/questions/${interviewId}/rounds/${firstRoundId}/prepare`)
            .set(auth)
            .set("origin", origin)
            .set("referer", `${origin}/`)
            .send({ count: 2 });
        if (prep.status !== 200) {
            console.error("Prepare failed:", prep.status, prep.body);
        }
        expect(prep.status).toBe(200);

        const refetched = await agent.get(`/api/interviews/${interviewId}`).set(auth).expect(200);
        const round = refetched.body.rounds[0].round;
        expect((round.questions || []).length).toBeGreaterThan(0);
    }, 120000);
});
