from pathlib import Path


def replace(path, old, new, count=1):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise RuntimeError(f"Expected snippet not found in {path}: {old[:160]!r}")
    p.write_text(text.replace(old, new, count))


# Personal data export contains personal Practice/account data only.
p = Path("server/src/routes/authRoutes.js")
text = p.read_text()
text = text.replace('import Assessment from "../models/Assessment.js";\nimport CandidateAttempt from "../models/CandidateAttempt.js";\n', '')
text = text.replace('        const assessmentIds = await Assessment.distinct("_id", { owner: userId });\n', '')
text = text.replace(
    '        const [profile, interviews, resumes, resumeReviews, savedExperiences, productFeedback, reminderDeliveries, productEvents, assessments, candidateAttempts] = await Promise.all([',
    '        const [profile, interviews, resumes, resumeReviews, savedExperiences, productFeedback, reminderDeliveries, productEvents] = await Promise.all([',
)
text = text.replace('            Assessment.find({ owner: userId }).lean(),\n            CandidateAttempt.find({ assessment: { $in: assessmentIds } }).lean(),\n', '')
text = text.replace(
    '        return res.json({ exportedAt: new Date().toISOString(), profile, interviews, assessments, candidateAttempts, resumes, resumeReviews, savedExperiences, productFeedback, reminderDeliveries, productEvents });',
    '        return res.json({ exportedAt: new Date().toISOString(), profile, interviews, resumes, resumeReviews, savedExperiences, productFeedback, reminderDeliveries, productEvents });',
)
export_section = text[text.find('router.get("/export"'):]
if 'owner: userId' in export_section or 'candidateAttempts' in export_section or 'assessments,' in export_section:
    raise RuntimeError('Legacy Hiring data remains in personal account export')
p.write_text(text)

# Account deletion understands organization ownership.
p = Path("server/src/controllers/authController.js")
text = p.read_text()
text = text.replace(
    'import CandidateAttempt from "../models/CandidateAttempt.js";\n',
    'import CandidateAttempt from "../models/CandidateAttempt.js";\nimport Organization from "../models/Organization.js";\nimport OrganizationMembership from "../models/OrganizationMembership.js";\n',
)
text = text.replace(
    '        const assessmentIds = await Assessment.distinct("_id", { owner: user._id });\n\n        await Promise.all([',
    '''        const ownedMemberships = await OrganizationMembership.find({ user: user._id, role: "owner", status: "active" }).select("organization").lean();
        const ownedOrganizationIds = ownedMemberships.map((membership) => membership.organization);
        for (const organizationId of ownedOrganizationIds) {
            const activeMembers = await OrganizationMembership.countDocuments({ organization: organizationId, status: "active" });
            if (activeMembers > 1) {
                return res.status(409).json({ message: "Transfer ownership of your hiring organization before deleting your account" });
            }
        }
        const assessmentIds = ownedOrganizationIds.length
            ? await Assessment.distinct("_id", { organization: { $in: ownedOrganizationIds } })
            : [];

        await Promise.all([''',
)
text = text.replace(
    '            CandidateAttempt.deleteMany({ assessment: { $in: assessmentIds } }),\n            Assessment.deleteMany({ owner: user._id }),\n            RefreshToken.deleteMany({ user: user._id }),',
    '''            CandidateAttempt.deleteMany({ assessment: { $in: assessmentIds } }),
            Assessment.deleteMany({ organization: { $in: ownedOrganizationIds } }),
            OrganizationMembership.deleteMany({ $or: [{ user: user._id }, { organization: { $in: ownedOrganizationIds } }] }),
            Organization.deleteMany({ _id: { $in: ownedOrganizationIds } }),
            RefreshToken.deleteMany({ user: user._id }),''',
)
if 'Assessment.deleteMany({ owner:' in text or 'distinct("_id", { owner:' in text:
    raise RuntimeError('Legacy assessment owner deletion remains')
p.write_text(text)

# Add explicit organization ownership transfer.
p = Path("server/src/controllers/organizationController.js")
text = p.read_text()
append = '''

export const transferOwnership = async (req, res, next) => {
    try {
        const actor = await activeMembership(req.params.organizationId, req.user._id);
        if (!actor || actor.role !== "owner") {
            return res.status(403).json({ message: "Only the organization owner can transfer ownership" });
        }
        const target = await OrganizationMembership.findOne({
            _id: req.body.membershipId,
            organization: req.params.organizationId,
            status: "active",
        }).populate("user", "_id name email");
        if (!target) return res.status(404).json({ message: "Member not found" });
        if (String(target.user?._id || target.user) === String(req.user._id)) {
            return res.status(400).json({ message: "Choose another team member" });
        }

        await OrganizationMembership.bulkWrite([
            { updateOne: { filter: { _id: target._id }, update: { $set: { role: "owner" } } } },
            { updateOne: { filter: { _id: actor._id }, update: { $set: { role: "admin" } } } },
        ]);

        return res.json({
            owner: {
                membershipId: target._id,
                user: target.user,
                role: "owner",
            },
            previousOwnerRole: "admin",
        });
    } catch (error) {
        return next(error);
    }
};
'''
if 'export const transferOwnership' not in text:
    text += append
p.write_text(text)

p = Path("server/src/routes/organizationRoutes.js")
text = p.read_text()
text = text.replace(
    '    updateOrganization,\n} from "../controllers/organizationController.js";',
    '    updateOrganization,\n    transferOwnership,\n} from "../controllers/organizationController.js";',
)
text = text.replace(
    'router.get("/:organizationId/members", validate(organizationParams, "params"), listMembers);\n',
    'router.get("/:organizationId/members", validate(organizationParams, "params"), listMembers);\nrouter.post("/:organizationId/transfer-ownership", validate(organizationParams, "params"), validate(z.object({ membershipId: ObjectIdString })), transferOwnership);\n',
)
p.write_text(text)

# Personal export test no longer expects organization-owned Hiring data.
p = Path("server/src/test/e2e/happyFlows.test.js")
text = p.read_text()
text = text.replace(
    '        expect(exportWithAssessments.body.assessments).toHaveLength(2);',
    '        expect(exportWithAssessments.body.assessments).toBeUndefined();\n        expect(exportWithAssessments.body.candidateAttempts).toBeUndefined();',
)
p.write_text(text)

print("Organization ownership semantics finalized")
