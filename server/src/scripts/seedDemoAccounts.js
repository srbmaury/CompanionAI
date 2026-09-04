import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import OrganizationMembership from "../models/OrganizationMembership.js";

dotenv.config();

const enabled = String(process.env.DEMO_ACCOUNT_SEED_ENABLED || "").toLowerCase() === "true";
const password = process.env.DEMO_ACCOUNT_PASSWORD || "";

const users = [
    { email: "admin@srbmaury.com", name: "Platform Admin", role: "admin" },
    ...Array.from({ length: 10 }, (_, index) => ({
        email: `candidate${String(index + 1).padStart(2, "0")}@srbmaury.com`,
        name: `Demo Candidate ${String(index + 1).padStart(2, "0")}`,
        role: "user",
    })),
    { email: "owner@srbmaury.com", name: "Demo Hiring Owner", role: "user" },
    { email: "recruiter1@srbmaury.com", name: "Demo Recruiter 1", role: "user" },
    { email: "recruiter2@srbmaury.com", name: "Demo Recruiter 2", role: "user" },
    { email: "manager1@srbmaury.com", name: "Demo Hiring Manager 1", role: "user" },
    { email: "reviewer1@srbmaury.com", name: "Demo Reviewer 1", role: "user" },
    { email: "reviewer2@srbmaury.com", name: "Demo Reviewer 2", role: "user" },
    { email: "owner2@srbmaury.com", name: "Demo Hiring Owner 2", role: "user" },
    { email: "orgadmin2@srbmaury.com", name: "Demo Organization Admin 2", role: "user" },
    { email: "recruiter3@srbmaury.com", name: "Demo Recruiter 3", role: "user" },
    { email: "recruiter4@srbmaury.com", name: "Demo Recruiter 4", role: "user" },
    { email: "manager2@srbmaury.com", name: "Demo Hiring Manager 2", role: "user" },
    { email: "reviewer3@srbmaury.com", name: "Demo Reviewer 3", role: "user" },
    { email: "reviewer4@srbmaury.com", name: "Demo Reviewer 4", role: "user" },
];

const organizations = [
    {
        name: "Srbmaury Demo Engineering",
        ownerEmail: "owner@srbmaury.com",
        members: [
            ["owner@srbmaury.com", "owner"],
            ["admin@srbmaury.com", "admin"],
            ["recruiter1@srbmaury.com", "recruiter"],
            ["recruiter2@srbmaury.com", "recruiter"],
            ["manager1@srbmaury.com", "hiring_manager"],
            ["reviewer1@srbmaury.com", "reviewer"],
            ["reviewer2@srbmaury.com", "reviewer"],
        ],
    },
    {
        name: "Srbmaury Demo Talent",
        ownerEmail: "owner2@srbmaury.com",
        members: [
            ["owner2@srbmaury.com", "owner"],
            ["orgadmin2@srbmaury.com", "admin"],
            ["recruiter3@srbmaury.com", "recruiter"],
            ["recruiter4@srbmaury.com", "recruiter"],
            ["manager2@srbmaury.com", "hiring_manager"],
            ["reviewer3@srbmaury.com", "reviewer"],
            ["reviewer4@srbmaury.com", "reviewer"],
            ["recruiter2@srbmaury.com", "reviewer"],
            ["manager1@srbmaury.com", "recruiter"],
        ],
    },
];

async function upsertUser(definition) {
    const email = definition.email.toLowerCase();
    let user = await User.findOne({ email }).select("+password +hiringTrialClaimed");
    if (!user) {
        user = new User({
            name: definition.name,
            email,
            password,
            provider: "local",
            isVerified: true,
            role: definition.role,
        });
    } else {
        user.name = definition.name;
        user.provider = "local";
        user.isVerified = true;
        user.role = definition.role;
        user.password = password;
        user.verificationToken = undefined;
        user.verificationTokenExpires = undefined;
    }
    await user.save();
    return user;
}

async function upsertOrganization(definition, userByEmail) {
    const owner = userByEmail.get(definition.ownerEmail);
    if (!owner) throw new Error(`Missing owner ${definition.ownerEmail}`);

    let organization = await Organization.findOne({ name: definition.name, createdBy: owner._id });
    if (!organization) {
        organization = await Organization.create({
            name: definition.name,
            createdBy: owner._id,
            hiringPlan: "trial",
            hiringTrialEligible: true,
        });
    } else {
        organization.name = definition.name;
        if (!["starter", "growth", "enterprise"].includes(organization.hiringPlan)) {
            organization.hiringPlan = "trial";
            organization.hiringTrialEligible = true;
        }
        await organization.save();
    }

    owner.hiringTrialClaimed = true;
    await owner.save();

    for (const [email, role] of definition.members) {
        const user = userByEmail.get(email);
        if (!user) throw new Error(`Missing organization member ${email}`);
        await OrganizationMembership.findOneAndUpdate(
            { organization: organization._id, user: user._id },
            {
                $set: { role, status: "active", joinedAt: new Date() },
                $setOnInsert: { organization: organization._id, user: user._id },
            },
            { upsert: true, new: true, runValidators: true },
        );
    }

    return organization;
}

async function run() {
    if (!enabled) {
        console.log("[DEMO-SEED] Disabled; skipping demo account seed.");
        return;
    }
    if (password.length < 12) {
        throw new Error("DEMO_ACCOUNT_PASSWORD must be at least 12 characters");
    }

    await connectDB();
    try {
        const userByEmail = new Map();
        for (const definition of users) {
            const user = await upsertUser(definition);
            userByEmail.set(definition.email, user);
        }

        const seededOrganizations = [];
        for (const definition of organizations) {
            seededOrganizations.push(await upsertOrganization(definition, userByEmail));
        }

        console.log(`[DEMO-SEED] Seeded ${users.length} verified @srbmaury.com accounts and ${seededOrganizations.length} organizations.`);
        console.log(`[DEMO-SEED] Platform admin: admin@srbmaury.com`);
        console.log(`[DEMO-SEED] Candidates: candidate01@srbmaury.com ... candidate10@srbmaury.com`);
        console.log(`[DEMO-SEED] Hiring roles include owner, admin, recruiter, hiring_manager, reviewer.`);
        console.log("[DEMO-SEED] No verification emails were sent; accounts were written directly as verified users.");
    } finally {
        await mongoose.connection.close();
    }
}

run().catch((error) => {
    console.error("[DEMO-SEED] Failed:", error?.message || error);
    process.exitCode = 1;
});
