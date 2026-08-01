import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import app from "../../app.js";
import User from "../../models/User.js";
import Resume from "../../models/Resume.js";
import ResumeReview from "../../models/ResumeReview.js";
import SavedExperience from "../../models/SavedExperience.js";
import ProductFeedback from "../../models/ProductFeedback.js";
import BillingEvent from "../../models/BillingEvent.js";
import UsageCounter from "../../models/UsageCounter.js";
import ReminderDelivery from "../../models/ReminderDelivery.js";
import ProductEvent from "../../models/ProductEvent.js";
import RefreshToken from "../../models/RefreshToken.js";
import { currentMonth, PLAN_LIMITS } from "../../services/entitlements.js";
import { deliverDuePracticeReminders } from "../../services/practiceReminders.js";
import Stripe from "stripe";
import Question from "../../models/Question.js";
import connectDB from "../../config/db.js";
import { signAccessToken } from "../../utils/tokens.js";

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

    it("allows only the newest session for an account", async () => {
        const origin = "http://localhost:5000";
        await User.create({ name: "Single Session", email: "single-session@example.com", password: "Passw0rd!", isVerified: true });
        const firstClient = request.agent(app);
        const secondClient = request.agent(app);
        const firstLogin = await firstClient.post("/api/auth/login").set("origin", origin).set("referer", `${origin}/`).send({ email: "single-session@example.com", password: "Passw0rd!" }).expect(200);
        const secondLogin = await secondClient.post("/api/auth/login").set("origin", origin).set("referer", `${origin}/`).send({ email: "single-session@example.com", password: "Passw0rd!" }).expect(200);

        await firstClient.get("/api/auth/profile").set("Authorization", `Bearer ${firstLogin.body.token}`).expect(401);
        await secondClient.get("/api/auth/profile").set("Authorization", `Bearer ${secondLogin.body.token}`).expect(200);
        const user = await User.findOne({ email: "single-session@example.com" });
        expect(await RefreshToken.countDocuments({ user: user._id })).toBe(1);
    });

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

        await Resume.insertMany(Array.from({ length: 6 }, (_, index) => ({
            user: me._id, fileUrl: `http://localhost/resumes/${index}.pdf`, publicId: `resumes/test-${index}`,
            fileName: `resume-${index}.pdf`, fileType: "application/pdf", fileSize: 100 + index,
            extractedText: "Pagination test resume", tags: [], notes: "",
        })));
        await ResumeReview.insertMany(Array.from({ length: 7 }, (_, index) => ({
            user: me._id, resume: resumeDoc._id, resumeName: resumeDoc.fileName, role: `Role ${index}`,
            summary: `Review ${index}`, atsScore: 70 + index,
        })));
        await SavedExperience.insertMany(Array.from({ length: 7 }, (_, index) => ({
            user: me._id, title: `Experience ${index}`, url: `https://example.com/${index}`,
            snippet: `Snippet ${index}`, company: "Acme", role: "Engineer",
        })));

        const resumePage = await agent.get("/api/resumes?page=2&limit=3").set(auth).expect(200);
        expect(resumePage.body.items).toHaveLength(3);
        expect(resumePage.body.total).toBe(7);
        expect(resumePage.body.totalPages).toBe(3);
        const reviewPage = await agent.get("/api/resumes/reviews?page=2&limit=5").set(auth).expect(200);
        expect(reviewPage.body.items).toHaveLength(2);
        expect(reviewPage.body.totalPages).toBe(2);
        const experiencePage = await agent.get("/api/experiences/saved?page=2&limit=5").set(auth).expect(200);
        expect(experiencePage.body.items).toHaveLength(2);
        expect(experiencePage.body.totalPages).toBe(2);

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
                    { roundName: "Round 2", description: "Online assessment", deliveryMode: "online-assessment", questionLimit: 2 },
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

        // A different authenticated user cannot read or mutate this user's resources.
        const otherUser = await User.create({
            name: "Other User",
            email: "other@example.com",
            provider: "google",
            googleId: "test-other-google-id",
            isVerified: true,
        });
        const otherAuth = { Authorization: `Bearer ${signAccessToken(otherUser._id, otherUser.tokenVersion)}` };
        await agent.get(`/api/interviews/${interviewId}`).set(otherAuth).expect(404);
        await agent
            .post("/api/interviews")
            .set(otherAuth)
            .set("origin", origin)
            .set("referer", `${origin}/`)
            .send({
                resumeId,
                company: "Acme",
                jobRole: "Software Engineer",
                jobDescription: "Build things",
                rounds: [{ roundName: "Round 1", description: "Conversational", deliveryMode: "conversational", questionLimit: 2 }],
            })
            .expect(404);
        await agent
            .post("/api/jobs/prepare-questions")
            .set(otherAuth)
            .set("origin", origin)
            .set("referer", `${origin}/`)
            .send({ interviewId, roundId: firstRoundId, count: 2 })
            .expect(404);
        await agent.get("/api/jobs/failed/prepare-questions").set(otherAuth).expect(403);
        await agent.get("/api/jobs/status/not-a-queue/job-id").set(otherAuth).expect(400);

        // Product feedback is visible and mutable only to administrators.
        const productFeedback = await ProductFeedback.create({ user: me._id, category: "idea", message: "Add more practice presets", page: "/dashboard" });
        await agent.get("/api/admin/feedback").set(auth).expect(403);
        await User.updateOne({ _id: otherUser._id }, { $set: { role: "admin" } });
        const adminFeedback = await agent.get("/api/admin/feedback?status=new&page=1&limit=10").set(otherAuth).expect(200);
        expect(adminFeedback.body.items.some((item) => item._id === String(productFeedback._id))).toBe(true);
        const reviewedFeedback = await agent.patch(`/api/admin/feedback/${productFeedback._id}`).set(otherAuth).set("origin", origin).set("referer", `${origin}/`).send({ status: "reviewed" }).expect(200);
        expect(reviewedFeedback.body.status).toBe("reviewed");

        // Stripe webhooks reject bad signatures and process each signed event only once.
        const webhookSecret = "whsec_meaningful_test_secret";
        const previousWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
        const webhookPayload = JSON.stringify({ id: "evt_idempotency_test", object: "event", type: "customer.updated", data: { object: { id: "cus_test" } } });
        await agent.post("/api/billing/webhook").set("content-type", "application/json").set("stripe-signature", "bad-signature").send(webhookPayload).expect(400);
        const stripe = new Stripe("sk_test_dummy");
        const signature = stripe.webhooks.generateTestHeaderString({ payload: webhookPayload, secret: webhookSecret });
        await agent.post("/api/billing/webhook").set("content-type", "application/json").set("stripe-signature", signature).send(webhookPayload).expect(200);
        const replay = await agent.post("/api/billing/webhook").set("content-type", "application/json").set("stripe-signature", signature).send(webhookPayload).expect(200);
        expect(replay.body.duplicate).toBe(true);
        expect(await BillingEvent.countDocuments({ eventId: "evt_idempotency_test" })).toBe(1);
        process.env.STRIPE_WEBHOOK_SECRET = previousWebhookSecret;

        // Account responses use an allowlist and never expose credential material.
        await User.updateOne({ _id: me._id }, { $set: { resetPasswordToken: "sensitive-hash", resetPasswordExpires: new Date(Date.now() + 60000) } });
        const profile = await agent.get("/api/auth/profile").set(auth).expect(200);
        expect(profile.body.email).toBe("t@example.com");
        expect(profile.body.password).toBeUndefined();
        expect(profile.body.resetPasswordToken).toBeUndefined();
        expect(profile.body.verificationToken).toBeUndefined();
        expect(profile.body.tokenVersion).toBeUndefined();
        expect(profile.body.plan).toBe("free");
        const updatedPlan = await agent.put("/api/auth/profile").set(auth).set("origin", origin).set("referer", `${origin}/`).send({ practiceGoal: "switch-role", targetRole: "Backend Engineer", weeklyPracticeTarget: 4, reminderEnabled: true, reminderDay: "monday", reminderTime: "19:00", reminderTimezone: "Asia/Kolkata" }).expect(200);
        expect(updatedPlan.body.user.targetRole).toBe("Backend Engineer");
        if (updatedPlan.body.token) auth.Authorization = `Bearer ${updatedPlan.body.token}`;
        await agent.post("/api/events").set(auth).set("origin", origin).set("referer", `${origin}/`).send({ event: "dashboard_viewed", path: "/dashboard" }).expect(202);
        expect(await ProductEvent.countDocuments({ user: me._id, event: "dashboard_viewed" })).toBe(1);
        await agent.post("/api/events").set(auth).set("origin", origin).set("referer", `${origin}/`).send({ event: "not_allowed" }).expect(400);
        await agent.post("/api/auth/reminders/test").set(auth).set("origin", origin).set("referer", `${origin}/`).expect(200);
        const previousReminderDelivery = process.env.REMINDER_DELIVERY_ENABLED;
        process.env.REMINDER_DELIVERY_ENABLED = "true";
        const dueAt = new Date("2026-08-03T13:35:00.000Z"); // Monday 19:05 Asia/Kolkata
        const firstDelivery = await deliverDuePracticeReminders(dueAt);
        const duplicateDelivery = await deliverDuePracticeReminders(dueAt);
        expect(firstDelivery).toMatchObject({ checked: 1, enqueued: 1, sent: 1, failed: 0 });
        expect(duplicateDelivery.enqueued).toBe(0);
        expect(await ReminderDelivery.countDocuments({ user: me._id, status: "sent" })).toBe(1);
        const deliveryHistory = await agent.get("/api/auth/reminders/deliveries").set(auth).expect(200);
        expect(deliveryHistory.body.items[0]).toMatchObject({ status: "sent", attempts: 1 });
        const exportResponse = await agent.get("/api/auth/export").set(auth).expect(200);
        expect(exportResponse.headers["content-disposition"]).toContain("companionai-export");
        expect(exportResponse.body).toMatchObject({ profile: { email: "t@example.com" } });
        expect(exportResponse.body.productEvents).toHaveLength(1);
        process.env.REMINDER_DELIVERY_ENABLED = previousReminderDelivery;
        const recommendations = await agent.get("/api/recommendations").set(auth).expect(200);
        expect(recommendations.body.goal).toBe("switch-role");
        expect(recommendations.body.actions).toHaveLength(3);
        const entitlements = await agent.get("/api/billing/entitlements").set(auth).expect(200);
        expect(entitlements.body.plan).toBe("free");
        expect(entitlements.body.used.interviews).toBe(1);
        expect(entitlements.body.limits.interviews).toBeGreaterThan(0);
        await UsageCounter.updateOne({ user: me._id, metric: "interviews", period: currentMonth() }, { $set: { used: PLAN_LIMITS.free.interviewsPerMonth } }, { upsert: true });
        const limited = await agent.post("/api/interviews").set(auth).set("origin", origin).set("referer", `${origin}/`).send({ resumeId, company: "Limit Test", jobRole: "Engineer", jobDescription: "Validate plan enforcement", rounds: [{ roundName: "Screen", description: "A valid screening round" }] }).expect(429);
        expect(limited.body).toMatchObject({ code: "PLAN_LIMIT_REACHED", metric: "interviews", limit: PLAN_LIMITS.free.interviewsPerMonth });
        expect(await UsageCounter.findOne({ user: me._id, metric: "interviews", period: currentMonth() }).lean()).toMatchObject({ used: PLAN_LIMITS.free.interviewsPerMonth });
        await agent
            .post(`/api/questions/${interviewId}/rounds/${firstRoundId}/prepare`)
            .set(otherAuth)
            .set("origin", origin)
            .set("referer", `${origin}/`)
            .send({ count: 2 })
            .expect(404);

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

        // Self-service deletion requires confirmation and removes account-owned data.
        await agent
            .delete("/api/auth/profile")
            .set(auth)
            .set("origin", origin)
            .set("referer", `${origin}/`)
            .send({ confirmation: "DELETE", password: "wrong" })
            .expect(400);
        await agent
            .delete("/api/auth/profile")
            .set(auth)
            .set("origin", origin)
            .set("referer", `${origin}/`)
            .send({ confirmation: "DELETE", password: "Passw0rd!" })
            .expect(200);
        expect(await User.exists({ _id: me._id })).toBeNull();
        expect(await Resume.exists({ user: me._id })).toBeNull();
    }, 120000);
});
