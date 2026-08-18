import express from "express";
import { z } from "zod";
import protect from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";
import quotas from "../middleware/quotas.js";
import audit from "../middleware/audit.js";
import { importJobPost } from "../services/jobPostImporter.js";

const router = express.Router();

router.post("/import", protect, quotas({ key: (req) => `user:${req.user._id}:job-post-import`, metricKey: "job_post_import", windowSeconds: 3600, maxPerWindow: 20 }), validate(z.object({ url: z.string().trim().url().max(2048) })), audit("job_post.import", { entityType: "JobPost", pickBody: () => ({}) }), async (req, res) => {
    try { return res.json(await importJobPost(req.body.url)); }
    catch (error) { return res.status(422).json({ message: error?.message || "The job post could not be imported." }); }
});

export default router;
