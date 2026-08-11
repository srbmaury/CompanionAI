# CompanionAI

AI-assisted interview practice and candidate screening: candidates can build role-specific practice sessions with voice or code, while hiring teams can create structured assessments, manage candidates, and review consistent reports.

## Key features
- Authentication: email verification, Google Sign-In, rotating access/refresh tokens, logout, password reset, and account deletion
- Resumes: upload to Cloudinary, type/size validation, tags/notes, search/sort, PDF inline preview
- Resume reviews: saved AI reviews with paginated history
- Interview rounds: AI‑suggested rounds from JD; supports conversational and online‑assessment (OA) modes
- Hiring workspace: hybrid AI/manual assessments, shareable candidate interviews, optional contextual follow-ups, a cross-interview candidate pipeline, and private interviewer-only reports
- Question generation: per‑round question sets with de‑duplication across rounds
- Feedback: per‑question feedback with score and improvement suggestions
- Voice: browser TTS, server-side Whisper transcription, and Web Speech fallback
- Experiences: search public interview experiences and save useful results
- Progress: score trends, completion history, monthly plan usage, and goal-based recommendations
- Reminders: timezone-aware weekly email reminders with durable delivery records, retries, history, and test delivery
- Billing: Stripe-hosted Checkout, customer portal, signed/idempotent webhooks, dynamic pricing, and monthly usage limits
- Assessment limits: 2 new assessments/month on Free and 50/month on Pro by default; public attempt actions also have Redis-backed abuse quotas
- Admin: role-protected feedback inbox with filtering, pagination, and status management
- Privacy: complete account-data deletion; the incomplete JSON export remains disabled behind client and server feature flags
- Product analytics: authenticated, allowlisted funnel events with automatic 180-day expiry
- API docs: OpenAPI/Swagger at `/api-docs`

## Architecture
- Client: React (Vite), Material UI, React Router, Axios (with credentials)
- Server: Express, Mongoose/MongoDB, Redis/BullMQ, Zod, Stripe, Cloudinary, Brevo Email API, Prometheus, and Sentry

Monorepo layout
```
client/                  # React app (Vite, MUI)
server/                  # Express API
  src/
    routes/              # Auth, interviews, reviews, billing, admin, analytics, reminders, jobs, STT, and code execution
    controllers/         # Controllers per domain
    models/              # Mongoose models (User, Resume, Interview, Round, Question, Feedback)
    utils/               # AI, code runner, mailer, parsing, etc.
    config/swagger.js    # OpenAPI config served at /api-docs
```

## Getting started
Prerequisites: Node 20+, MongoDB, Cloudinary, and at least one AI provider.

Production also requires Redis, Brevo transactional email, CAPTCHA, Stripe, HTTPS, and MongoDB transaction support. Judge0 is required only when code execution is enabled.

1) Install
```bash
cd server && npm i && cd ../client && npm i
```

2) Configure environment

- Server: copy the example and fill required values
  - Local minimum: `MONGO_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`, Cloudinary credentials, and `OPENAI_API_KEY` or `GEMINI_API_KEY`
  - Brevo API access is required for verification, password reset, and reminders
  - Stripe requires `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRO_PRICE_ID`
  - Production startup fails fast if Redis, metrics protection, CAPTCHA, or enabled feature dependencies are missing
  - Full list and sane defaults live in `server/.env.example`
```bash
cp server/.env.example server/.env
```

- Client: create `client/.env` and set your client keys
  - Typical: `VITE_API_BASE_URL=/api`
  - If enabling CAPTCHA or Google Sign‑In, set corresponding `VITE_*` keys
  - See `client/README.md` for details
  - Account-data export is hidden and blocked by default. Enable it only after the archive is complete and sanitized by setting both `VITE_ACCOUNT_DATA_EXPORT_ENABLED=true` and server-side `ACCOUNT_DATA_EXPORT_ENABLED=true`.

3) Run locally
```bash
# terminal 1
cd server && npm run dev
# terminal 2
cd client && npm run dev
```
Client: http://localhost:5173 • Server: http://localhost:5000

4) Verify
```bash
cd client && npm run lint && npm test -- --run && npm run build
cd ../server && npm test -- --run && npm run audit
```

Run the browser journeys on desktop and mobile Chromium with:

```bash
cd client
npx playwright install chromium
npm run test:e2e
```

The browser suite verifies dual-audience landing content, login restoration after a full reload, recruiter pipeline management, and the candidate assessment journey. API responses from external or stateful services are deterministic in this UI suite; the server API journeys provide the database and authorization coverage. CI retains Playwright traces, screenshots, videos, HTML output, and JUnit results when a run fails.

Run the launch-critical end-to-end product journey separately with:

```bash
cd server && npm run test:launch
```

The journey covers authentication and single-session enforcement, profile goals and reminders, resume metadata and pagination, saved experiences, interviews and authorization, admin feedback, Stripe webhook idempotency, entitlements, assessments and candidate privacy, export, analytics, usage limits, and account deletion. External AI generation is forced into deterministic test mode so CI does not spend provider credits or depend on network availability. Use `npm run test:e2e` to run every server E2E file.

GitHub Actions runs these checks on pushes and pull requests. Dependabot checks dependencies weekly.

## API and docs
- OpenAPI UI: `GET /api-docs`
- OpenAPI JSON: `GET /api-docs.json`

Highlighted endpoints
- Auth: `/api/auth/*` (register, login, logout, refresh, verify-email, password reset, profile, reminder test/history, data export, deletion)
- Interviews: `GET /api/interviews?page&limit` (paginated) · `POST /api/interviews` · `GET /api/interviews/{id}` · `GET /api/interviews/analytics/progress`
- Rounds: `POST /api/rounds/suggest` (AI) · `POST /api/rounds` (manual)
- Questions: `POST /api/questions/{interviewId}/rounds/{roundId}/prepare` · `POST /api/questions/{roundId}/answer` · `POST /api/questions/{roundId}/answers` · `POST /api/questions/{roundId}/complete` · `DELETE /api/questions/{interviewId}/rounds/{roundId}`
- Feedback: `POST /api/feedback/{questionId}` · `GET /api/feedback/{questionId}` · `POST /api/feedback/bulk` · `POST /api/feedback/attach/{roundId}`
- Resumes: `POST /api/resumes` · `GET /api/resumes` (sort/tag/q) · `PUT /api/resumes/{id}` · `DELETE /api/resumes/{id}` · `GET /api/resumes/{id}/preview` · `POST /api/resumes/{id}/review` · `GET /api/resumes/reviews`
- STT: `POST /api/stt/transcribe` (multipart `audio`)
- Run Code: `POST /api/run-code`
- Experiences: `GET /api/experiences/search?company=&role=`
- Billing: `GET /api/billing/entitlements` · `POST /api/billing/checkout-session` · `POST /api/billing/portal-session` · `POST /api/billing/webhook`
- Recommendations: `GET /api/recommendations`
- Candidate assessments: `POST /api/assessments` · `GET /api/assessments` · `GET /api/assessments/overview` · `GET /api/assessments/{id}` · public link endpoints under `/api/assessments/public/{shareToken}`
- Product feedback: `POST /api/product-feedback`
- Product events: `POST /api/events`
- Admin: `GET /api/admin/feedback` · `PATCH /api/admin/feedback/{feedbackId}`
- Operations: `GET /health/liveness` · `GET /health/readiness` · `GET /metrics`

## Frontend routes
- `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`
- `/` (product landing page)
- `/dashboard`, `/progress`
- `/create-interview`, `/interviews/:interviewId`
- `/assessments`, `/assessments/:assessmentId`, `/assessment/:shareToken`
- `/experiences`, `/saved-experiences`
- `/resume-review`, `/resume-reviews`, `/resumes`
- `/pricing`, `/billing/success`
- `/profile`, `/admin/feedback`
- `/privacy`, `/terms`

## Security highlights
- Short-lived bearer access tokens, HTTP-only rotating refresh cookies, CORS allowlists, and state-changing origin checks
- Secure cookies (SameSite, domain) and JWT rotation; per‑user session caps
- Quotas and rate limiting (Redis‑backed) across sensitive routes
- CAPTCHA gates for auth endpoints (recommended in production)
- Code execution via Judge0 is opt‑in and host‑allowlisted
- File uploads validated by magic bytes, size; optional AV scanning
- Metrics endpoint protected by token; structured JSON logging with request IDs
- Durable reminder delivery records with idempotency and retry backoff
- Stripe webhook signature validation and event idempotency
- Unconditional Zod request validation plus database-level constraints
- Unguessable assessment links plus hashed per-attempt credentials; public candidate responses never include scores or private feedback
- CI dependency audits and weekly Dependabot updates

## Background processing

BullMQ handles question preparation and bulk feedback when Redis is configured. Reminder schedules are evaluated every five minutes, persisted as delivery records, atomically claimed, and retried with exponential backoff. For initial deployments, run one worker-enabled API replica; split workers and reminder dispatch into dedicated process types before horizontal scaling. See `RUNBOOK.md`.

## Billing setup

1. Create a recurring Stripe Price and set `STRIPE_PRO_PRICE_ID`.
2. Set the restricted or secret server key as `STRIPE_SECRET_KEY`; never expose it to the client.
3. Forward or configure Stripe webhooks at `/api/billing/webhook` and set the signing secret.
4. Test checkout, subscription updates, failed/recovered payments, refunds, disputes, cancellation, and portal access in Stripe test mode before using live keys.

The pricing UI reads amount, currency, and interval from Stripe rather than hard-coding them.

## Brevo email setup

1. Create a Brevo account and add `companionai.email@gmail.com` under **Settings → Senders, Domains & Dedicated IPs → Senders**.
2. Enter the verification code Brevo sends to that Gmail inbox.
3. Create a Brevo API key under **Settings → SMTP & API → API Keys**.
4. Add `BREVO_API_KEY`, `BREVO_SENDER_EMAIL=companionai.email@gmail.com`, and `BREVO_SENDER_NAME=CompanionAI` to the API service environment.
5. Redeploy and confirm the startup log includes `Brevo API verified: transactional email ready`, then send a test reminder from Profile.

Brevo accepts a verified Gmail sender, but free-email domains cannot be authenticated with DKIM/DMARC and may be rewritten or have poorer deliverability. Move to an authenticated CompanionAI-owned domain before a public launch.

## Production checklist
- Use TLS for MongoDB/Redis; enforce HTTPS, HSTS, and Helmet
- Configure CSP allowlists via `CSP_*` envs and validate the client
- Set up monitoring and alerts for `/health/readiness`, reminder failures, queue failures, and Stripe webhook failures
- See `RUNBOOK.md` for deployment, rollback, health checks, backups, workers, and incident response
- Use `observability/README.md` for Grafana panels, PromQL queries, and production alert thresholds
- Review `SECURITY.md` and publish production-specific privacy, AI-processing, refund, and data-retention policies

## Known dependency exception

The current React Router advisory concerns React Server Components action handling. CompanionAI is a client-only BrowserRouter SPA and does not enable React Router framework/RSC actions. CI still fails on critical production advisories, and this exception should be removed when a patched upstream release is available.

License: MIT
