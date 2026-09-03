export const HIRING_ROLES = Object.freeze({
    OWNER: "owner",
    ADMIN: "admin",
    RECRUITER: "recruiter",
    HIRING_MANAGER: "hiring_manager",
    REVIEWER: "reviewer",
});

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

export const hiringPermissionsFor = (role) => ({
    role: role || null,
    canViewOverview: VIEW_HIRING_OVERVIEW.has(role),
    canViewCandidatePipeline: REVIEW_CANDIDATES.has(role),
    canViewAssessments: VIEW_ASSESSMENTS.has(role),
    canManageAssessments: MANAGE_ASSESSMENTS.has(role),
    canReviewCandidates: REVIEW_CANDIDATES.has(role),
    canManageOrganization: MANAGE_ORGANIZATION.has(role),
    canManageHiringBilling: MANAGE_ORGANIZATION.has(role),
});

export const hiringHomeForRole = (role) =>
    role === HIRING_ROLES.REVIEWER ? "/assessments#candidate-pipeline" : "/assessments";
