import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import app from "../../app.js";
import connectDB from "../../config/db.js";
import Feedback from "../../models/Feedback.js";
import Interview from "../../models/Interview.js";
import Question from "../../models/Question.js";
import Resume from "../../models/Resume.js";
import Round from "../../models/Round.js";
import User from "../../models/User.js";
import { signAccessToken } from "../../utils/tokens.js";

let replset;
let agent;

const authFor = (user) => ({
    Authorization: `Bearer ${signAccessToken(user._id, user.tokenVersion)}`,
});

const createResume = (user, suffix) => Resume.create({
    user: user._id,
    fileUrl: `http://localhost/resumes/${suffix}.pdf`,
    publicId: `resumes/${suffix}`,
    fileName: `${suffix}.pdf`,
    fileType: "application/pdf",
    fileSize: 100,
    extractedText: "Resume text",
});

const createInterview = async ({ user, resume, scores, statuses, createdAt }) => {
    const question = await Question.create({ text: `Question ${createdAt.toISOString()}` });
    const rounds = [];
    for (let index = 0; index < statuses.length; index += 1) {
        const feedback = Number.isFinite(scores[index])
            ? await Feedback.create({ user: user._id, question: question._id, comment: "Useful feedback", score: scores[index] })
            : null;
        rounds.push(await Round.create({
            name: `Round ${index + 1}`,
            description: "Test round",
            status: statuses[index],
            questions: feedback ? [{ question: question._id, feedback: feedback._id }] : [],
        }));
    }
    return Interview.create({
        user: user._id,
        resume: resume._id,
        company: "Acme",
        jobRole: "Engineer",
        jobDescription: "Build software",
        rounds: rounds.map((round) => ({ round: round._id })),
        createdAt,
        updatedAt: createdAt,
    });
};

describe("GET /api/interviews/analytics/progress", () => {
    beforeAll(async () => {
        replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
        process.env.MONGO_URI = replset.getUri();
        process.env.NODE_ENV = "test";
        process.env.MONGO_TLS = "false";
        process.env.MONGO_REQUIRE_TRANSACTIONS = "false";
        await connectDB();
        agent = request.agent(app);
    }, 60000);

    afterAll(async () => {
        try { await mongoose.connection.close(); } catch {}
        if (replset) await replset.stop();
    }, 30000);

    it("calculates totals, completed interviews, score averages, improvement, and recent history", async () => {
        const user = await User.create({
            name: "Analytics User",
            email: "analytics@example.com",
            provider: "google",
            googleId: "analytics-google-id",
            isVerified: true,
        });
        const resume = await createResume(user, "analytics");

        await createInterview({ user, resume, scores: [4, 6], statuses: ["completed", "completed"], createdAt: new Date("2026-01-01") });
        await createInterview({ user, resume, scores: [8], statuses: ["completed"], createdAt: new Date("2026-01-02") });
        await createInterview({ user, resume, scores: [], statuses: ["in_progress"], createdAt: new Date("2026-01-03") });

        const response = await agent.get("/api/interviews/analytics/progress").set(authFor(user)).expect(200);

        expect(response.body).toMatchObject({ total: 3, completed: 2, averageScore: 6.5, improvement: 3 });
        expect(response.body.recent).toHaveLength(2);
        expect(response.body.recent.map(({ score }) => score)).toEqual([5, 8]);
        expect(response.body.recent.map(({ date }) => date)).toEqual([
            "2026-01-01T00:00:00.000Z",
            "2026-01-02T00:00:00.000Z",
        ]);
    });

    it("only includes interviews owned by the authenticated user", async () => {
        const owner = await User.create({ name: "Owner", email: "owner@example.com", provider: "google", googleId: "owner-google-id", isVerified: true });
        const other = await User.create({ name: "Other", email: "isolated@example.com", provider: "google", googleId: "isolated-google-id", isVerified: true });
        const ownerResume = await createResume(owner, "owner");
        const otherResume = await createResume(other, "other");
        await createInterview({ user: owner, resume: ownerResume, scores: [3], statuses: ["completed"], createdAt: new Date("2026-02-01") });
        await createInterview({ user: other, resume: otherResume, scores: [10], statuses: ["completed"], createdAt: new Date("2026-02-02") });

        const ownerResponse = await agent.get("/api/interviews/analytics/progress").set(authFor(owner)).expect(200);
        const otherResponse = await agent.get("/api/interviews/analytics/progress").set(authFor(other)).expect(200);

        expect(ownerResponse.body).toMatchObject({ total: 1, completed: 1, averageScore: 3, improvement: 0 });
        expect(ownerResponse.body.recent.map(({ score }) => score)).toEqual([3]);
        expect(otherResponse.body).toMatchObject({ total: 1, completed: 1, averageScore: 10, improvement: 0 });
        expect(otherResponse.body.recent.map(({ score }) => score)).toEqual([10]);
    });
});
