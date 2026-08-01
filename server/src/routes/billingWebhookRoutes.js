import express from "express";
import { stripeWebhook } from "../controllers/billingWebhookController.js";

const router = express.Router();
router.post("/", stripeWebhook);
export default router;
