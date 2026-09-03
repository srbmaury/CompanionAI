import express from "express";
import { z } from "zod";
import protect from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";
import { ObjectIdString } from "../validation/commonSchemas.js";
import {
    addMember,
    createOrganization,
    listMembers,
    listOrganizations,
    removeMember,
    updateMemberRole,
    updateOrganization,
} from "../controllers/organizationController.js";

const router = express.Router();
const role = z.enum(["admin", "recruiter", "hiring_manager", "reviewer"]);
const organizationParams = z.object({ organizationId: ObjectIdString });
const memberParams = z.object({ organizationId: ObjectIdString, membershipId: ObjectIdString });

router.use(protect);
router.get("/", listOrganizations);
router.post("/", validate(z.object({ name: z.string().trim().min(2).max(120) })), createOrganization);
router.patch("/:organizationId", validate(organizationParams, "params"), validate(z.object({ name: z.string().trim().min(2).max(120) })), updateOrganization);
router.get("/:organizationId/members", validate(organizationParams, "params"), listMembers);
router.post("/:organizationId/members", validate(organizationParams, "params"), validate(z.object({ email: z.string().trim().email().max(254), role })), addMember);
router.patch("/:organizationId/members/:membershipId", validate(memberParams, "params"), validate(z.object({ role })), updateMemberRole);
router.delete("/:organizationId/members/:membershipId", validate(memberParams, "params"), removeMember);

export default router;
