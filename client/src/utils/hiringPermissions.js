export const HIRING_ROLES = Object.freeze({
    OWNER: "owner",
    ADMIN: "admin",
    RECRUITER: "recruiter",
    HIRING_MANAGER: "hiring_manager",
    REVIEWER: "reviewer",
});

export const HIRING_ROLE_LABELS = Object.freeze({
    [HIRING_ROLES.OWNER]: "Owner",
    [HIRING_ROLES.ADMIN]: "Admin",
    [HIRING_ROLES.RECRUITER]: "Recruiter",
    [HIRING_ROLES.HIRING_MANAGER]: "Hiring manager",
    [HIRING_ROLES.REVIEWER]: "Reviewer",
});

export const ASSIGNABLE_HIRING_ROLES = Object.freeze([
    HIRING_ROLES.ADMIN,
    HIRING_ROLES.RECRUITER,
    HIRING_ROLES.HIRING_MANAGER,
    HIRING_ROLES.REVIEWER,
]);

const MANAGE_ASSESSMENTS = new Set([
    HIRING_ROLES.OWNER,
    HIRING_ROLES.ADMIN,
    HIRING_ROLES.RECRUITER,
]);

const VIEW_HIRING_OVERVIEW = new Set([
    HIRING_ROLES.OWNER,
    HIRING_ROLES.ADMIN,
    HIRING_ROLES.RECRUITER,
    HIRING_ROLES.HIRING_MANAGER,
]);

const VIEW_ASSESSMENTS = new Set(VIEW_HIRING_OVERVIEW);
const REVIEW_CANDIDATES = new Set(Object.values(HIRING_ROLES));
const MANAGE_ORGANIZATION = new Set([HIRING_ROLES.OWNER, HIRING_ROLES.ADMIN]);
const EXPORT_CANDIDATE_DATA = new Set([
    HIRING_ROLES.OWNER,
    HIRING_ROLES.ADMIN,
    HIRING_ROLES.RECRUITER,
    HIRING_ROLES.HIRING_MANAGER,
]);

export const hiringPermissionsFor = (role) => ({
    role: role || null,
    canViewOverview: VIEW_HIRING_OVERVIEW.has(role),
    canViewCandidatePipeline: REVIEW_CANDIDATES.has(role),
    canViewAssessments: VIEW_ASSESSMENTS.has(role),
    canManageAssessments: MANAGE_ASSESSMENTS.has(role),
    canReviewCandidates: REVIEW_CANDIDATES.has(role),
    canExportCandidateData: EXPORT_CANDIDATE_DATA.has(role),
    canManageOrganization: MANAGE_ORGANIZATION.has(role),
    canManageHiringBilling: MANAGE_ORGANIZATION.has(role),
});

export const assignableHiringRolesFor = (actorRole) => {
    if (actorRole === HIRING_ROLES.OWNER) return [...ASSIGNABLE_HIRING_ROLES];
    if (actorRole === HIRING_ROLES.ADMIN) {
        return ASSIGNABLE_HIRING_ROLES.filter((role) => role !== HIRING_ROLES.ADMIN);
    }
    return [];
};

export const canManageHiringMember = (actorRole, targetRole) => {
    if (targetRole === HIRING_ROLES.OWNER) return false;
    if (actorRole === HIRING_ROLES.OWNER) return true;
    return actorRole === HIRING_ROLES.ADMIN && targetRole !== HIRING_ROLES.ADMIN;
};

export const hiringHomeForRole = (role) =>
    role === HIRING_ROLES.REVIEWER ? "/assessments#candidate-pipeline" : "/assessments";
