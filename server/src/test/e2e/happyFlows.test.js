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
let csrfToken;

describe("Happy flows E2E", () => {
    beforeAll(async () => {
        // Start in-memory replica set to support transactions
        replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
        const uri = replset.getUri();
        process.env.MONGO_URI = uri;
        process.env.NODE_ENV = "test";
        process.env.MONGO_TLS = "false";
        process.env.MONGO_REQUIRE_TRANSACTIONS = "false";
        process.env.CSRF_SAMESITE = "lax";
        process.env.TEST_FORCE_GENERATOR_EMPTY = "true";
        await connectDB();
        agent = request.agent(app);
        // Prime CSRF cookie
        const res = await agent.get("/health/liveness").expect(200);
        const setCookies = res.headers["set-cookie"] || [];
        const csrfCookie = (Array.isArray(setCookies) ? setCookies : [setCookies]).find((c) => /csrfToken=/.test(c));
        if (csrfCookie) {
            const m = /csrfToken=([^;]+)/.exec(csrfCookie);
            csrfToken = m ? m[1] : undefined;
        }
    }, 60000);

    afterAll(async () => {
        try { await mongoose.connection.close(); } catch {}
        if (replset) await replset.stop();
    }, 30000);

    it("registers, logs in, uploads resume, creates interview, prepares first round", async () => {
        // Register
        const reg = await agent
            .post("/api/auth/register")
            .send({ name: "Test User", email: "t@example.com", password: "Passw0rd!" })
            .set("x-csrf-token", csrfToken)
            .set("origin", "http://localhost:5000")
            .set("referer", "http://localhost:5000/")
            .set("Cookie", `csrfToken=${csrfToken}`)
            .expect(201);

        // Mark user verified for test login
        const u = await User.findOne({ email: "t@example.com" });
        u.isVerified = true;
        await u.save();

        // Login
        const login = await agent
            .post("/api/auth/login")
            .send({ email: "t@example.com", password: "Passw0rd!" })
            .set("x-csrf-token", csrfToken)
            .set("origin", "http://localhost:5000")
            .set("referer", "http://localhost:5000/")
            .set("Cookie", `csrfToken=${csrfToken}`)
            .expect(200);

        // Capture jwt cookie for authenticated requests
        const setCookiesLogin = login.headers["set-cookie"] || [];
        const jwtCookieStr = (Array.isArray(setCookiesLogin) ? setCookiesLogin : [setCookiesLogin]).find((c) => /jwt=/.test(c)) || "";
        const jwtValueMatch = /jwt=([^;]+)/.exec(jwtCookieStr);
        const jwtValue = jwtValueMatch ? jwtValueMatch[1] : "";

        // Create minimal resume directly via model bypass (or mock)
        // For E2E simplicity, create an interview without actual resume upload
        // Create interview with 2 rounds
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
        const create = await agent
            .post("/api/interviews")
            .send({
                resumeId,
                company: "Acme",
                jobRole: "Software Engineer",
                jobDescription: "Build things",
                rounds: [
                    { roundName: "Round 1", description: "Conversational", deliveryMode: "conversational", questionLimit: 2 },
                    { roundName: "Round 2", description: "OA", deliveryMode: "online-assessment", questionLimit: 2 },
                ],
            })
            .set("x-csrf-token", csrfToken)
            .set("origin", "http://localhost:5000")
            .set("referer", "http://localhost:5000/")
            .set("Cookie", `csrfToken=${csrfToken}; jwt=${jwtValue}`)
            .then((res) => {
                if (res.status !== 201) {
                    // eslint-disable-next-line no-console
                    console.error("CreateInterview failed:", res.status, res.body);
                }
                return res;
            });

        expect(create.status).toBe(201);
        expect(create.body?._id).toBeDefined();
        const interviewId = create.body._id;

        // Fetch interview
        const fetched = await agent.get(`/api/interviews/${interviewId}`).expect(200);
        expect(Array.isArray(fetched.body?.rounds)).toBe(true);
        const firstRoundId = fetched.body.rounds[0].round._id;

        // Seed a few generic questions to let generator fallback succeed without external calls
        await Question.create([
            { text: "Explain event loop in Node.js", tags: ["node", "event loop"] },
            { text: "What is closure in JavaScript?", tags: ["javascript"] },
            { text: "Describe REST vs GraphQL", tags: ["api"] },
        ]);

        // Prepare first round synchronously via controller (dev-only path)
        const prep = await agent
            .post(`/api/questions/${interviewId}/rounds/${firstRoundId}/prepare`)
            .send({ count: 2 })
            .set("x-csrf-token", csrfToken)
            .set("origin", "http://localhost:5000")
            .set("referer", "http://localhost:5000/")
            .set("Cookie", `csrfToken=${csrfToken}`)
            .then((res) => {
                if (res.status !== 200) {
                    // eslint-disable-next-line no-console
                    console.error("Prepare failed:", res.status, res.body);
                }
                return res;
            });
        expect(prep.status).toBe(200);

        const refetched = await agent.get(`/api/interviews/${interviewId}`).expect(200);
        const round = refetched.body.rounds[0].round;
        expect((round.questions || []).length).toBeGreaterThan(0);
    }, 120000);
});
