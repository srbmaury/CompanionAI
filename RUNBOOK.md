# CompanionAI production runbook

## Deployment topology

Run the React build behind a CDN and the API as a Node 20+ service. Production requires MongoDB with transactions, Redis, HTTPS, Brevo transactional email API access, Cloudinary, CAPTCHA, Stripe, and at least one AI provider. The API process currently starts BullMQ workers and the reminder dispatcher; deploy one worker-enabled API replica until these are split into dedicated process types.

## Pre-deployment

1. Run `npm ci`, tests, lint, build, and production dependency audits in both packages.
2. Confirm `/health/readiness` returns 200 in staging.
3. Send a test reminder and complete a Stripe test checkout.
4. Verify Stripe webhook delivery and replay behavior.
5. Confirm MongoDB and Cloudinary backups before schema-affecting releases.

## Environment and secrets

Use a secret manager. Never commit `.env`. Rotate JWT, Brevo, Stripe, AI, Cloudinary, Redis, CAPTCHA, metrics, and Sentry credentials after suspected exposure. Configure both `ALLOWED_ORIGINS` and `CLIENT_ORIGIN` explicitly in production.

## Deployment and rollback

Deploy immutable artifacts. Wait for readiness before routing traffic. On failure, route traffic to the previous artifact; do not roll back persisted data without a reviewed migration rollback. Stripe webhook events are idempotent and can be replayed after recovery.

## Backups

- Enable continuous MongoDB backups with point-in-time recovery.
- Test restoration quarterly into an isolated account.
- Cloudinary assets should use provider backups or version retention.
- Export Stripe configuration separately; Stripe remains the billing ledger.

## Alerts

Alert on readiness failures, elevated 5xx responses, authentication spikes, rate-limit spikes, queue failures, reminders in `failed` state, Stripe webhook 5xx responses, Brevo API failures, and AI error/cost anomalies.

## Reminder recovery

Reminder deliveries are persisted in MongoDB and retried with exponential backoff. After an outage, restart the API and inspect `reminderdeliveries` for failed records and `lastError`. Do not delete sent records; their unique user/reminder key prevents duplicates.

## Stripe incidents

Check webhook signing secret, event delivery status, `billingevents`, and the affected user's Stripe customer/subscription IDs. Replay failed webhook events from Stripe after fixing the cause. Never grant Pro access solely from a client redirect.

## Security incident

Restrict traffic, preserve logs, rotate affected credentials, revoke sessions by incrementing user token versions, assess affected records, and follow applicable notification requirements. Record timeline, scope, remediation, and follow-up actions.
