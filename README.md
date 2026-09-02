# CompanionAI

AI-assisted interview practice and candidate screening: candidates can build role-specific practice sessions with voice or code, while hiring teams can create structured assessments, manage candidates, and review consistent reports.

See [TESTING.md](TESTING.md) for the short test-command reference.

## Key features
- Authentication: email verification, Google Sign-In, rotating access/refresh tokens, logout, password reset, and account deletion
- Resumes: upload to Cloudinary, type/size validation, tags/notes, search/sort, PDF inline preview
- Resume reviews: saved AI reviews with paginated history
- Resume matching: rank every owned resume against a JD with explainable keyword coverage and evidence, without consuming AI-review credits
- Job-post import: paste a public job link to prefill editable role, company, and description fields in practice, resume review, and recruiter assessment flows
- Interview rounds: AI‑suggested rounds from the JD; supports conversational, online‑assessment (OA), and system-design modes with a shared candidate experience
- Hiring workspace: hybrid AI/manual assessments, embedded Excalidraw system-design rounds with autosaved diagrams, reusable starter templates and version duplication, bulk email invitations with invite-only access and lifecycle tracking, weighted competency scorecards, human review overrides, optional contextual follow-ups, and private interviewer-only reports
- System-design intelligence: extracts labelled components, bound connections, element counts, and groups from the Excalidraw scene; combines that topology with written and spoken explanations; asks one bounded, design-specific AI interviewer probe; and retains the complete evidence for recruiter review
- Assessment resilience and integrity: local draft recovery, idempotent submission, camera readiness, optional on-device sustained face-presence/multiple-face detection, configurable fullscreen/focus/clipboard/connectivity signals with explicit consent, human-only interpretation, and automatic retention cleanup
- Question generation: per‑round question sets with de‑duplication across rounds
- Feedback: per‑question feedback with score and improvement suggestions
- Voice: browser TTS, server-side Whisper transcription, and Web Speech fallback
- Experiences: search public interview experiences and save useful results
- Progress: score trends, completion history, monthly plan usage, and goal-based recommendations
- Reminders: timezone-aware weekly email reminders with durable delivery records, retries, history, and test delivery
- Billing: Stripe-hosted Checkout, customer portal, signed/idempotent webhooks, dynamic pricing, and monthly usage limits
- Plan limits: Free includes 3 interviews, 3 resume reviews, and 2 assessments monthly; Pro raises those to 100/100/50; Scale raises them to 1000/1000/500 by default. Public attempt actions retain Redis-backed abuse quotas on every plan.
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
    models/              # Mongoose models, including users, resumes, interviews, assessments, attempts, feedback, billing, and delivery records
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
  - Stripe requires `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, and `STRIPE_SCALE_PRICE_ID`
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

The browser suite verifies dual-audience landing content, login restoration after a full reload, recruiter pipeline management, hybrid assessment creation, candidate privacy, and movement through conversational, coding, and system-design rounds on desktop and mobile. API responses from external or stateful services are deterministic in this UI suite; the server API journeys provide the database and authorization coverage. CI retains Playwright traces, screenshots, videos, HTML output, and JUnit results when a run fails.

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
- Resume matching: `POST /api/resumes/match`
- STT: `POST /api/stt/transcribe` (multipart `audio`)
- Run Code: `POST /api/run-code`
- Experiences: `GET /api/experiences/search?company=&role=`
- Job posts: `POST /api/job-posts/import` (authenticated, rate-limited public-page extraction)
- Billing: `GET /api/billing/entitlements` · `POST /api/billing/checkout-session` · `POST /api/billing/portal-session` · `POST /api/billing/webhook`
- Recommendations: `GET /api/recommendations`
- Candidate assessments: create/list/overview/report, duplicate versions, invite/resend/revoke candidates, save answers and system-design scenes, generate contextual AI probes, save human scorecards, and record consented integrity events under `/api/assessments` and `/api/assessments/public/{shareToken}`
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
- `/resume-review`, `/resume-reviews`, `/resume-match`, `/resumes`
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
- System-design AI treats extracted topology as uncertain evidence, never as ground truth, and is instructed not to score visual polish or drawing quality
- CI dependency audits and weekly Dependabot updates

## System-design interview behavior

System-design rounds use an Excalidraw canvas alongside written and voice-enabled explanation fields. Canvas changes are retained locally and synchronized to the API. When the candidate saves a response and contextual follow-ups are enabled, CompanionAI:

1. Extracts readable labels, element counts, groups, and bound component-to-component connections from the scene JSON.
2. Combines that machine-readable topology with the original question and the candidate's written and spoken explanation.
3. Generates one neutral interviewer probe about a concrete decision, missing requirement, failure mode, capacity assumption, consistency choice, security boundary, or observability gap.
4. Speaks and displays the probe, then stores the candidate's response with the final report.
5. Evaluates the complete evidence against role context, round focus, and the recruiter scorecard after submission.

The AI cannot modify the canvas, reveal a solution, coach the candidate, or show scores during a recruiter assessment. Diagram extraction can be incomplete when arrows are visually positioned but not bound to shapes, so the evaluator is required to state uncertainty and recruiters should verify claims against the original canvas. Continuous autonomous conversation is intentionally avoided to preserve candidate comparability, predictable duration, and cost control.

## Background processing

BullMQ handles question preparation, bulk feedback, and recruiter assessment evaluation when Redis is configured. Candidate submissions are atomically moved to an evaluating state, retried by the worker, and recovered on startup if an API process stopped before enqueueing. Reminder schedules are evaluated every five minutes, persisted as delivery records, atomically claimed, and retried with exponential backoff. For initial deployments, run one worker-enabled API replica; split workers and reminder dispatch into dedicated process types before horizontal scaling. See `RUNBOOK.md`.

## Billing setup

1. Create separate recurring Stripe Prices for Pro and Scale, then set `STRIPE_PRO_PRICE_ID` and `STRIPE_SCALE_PRICE_ID`.
2. Set the restricted or secret server key as `STRIPE_SECRET_KEY`; never expose it to the client.
3. Forward or configure Stripe webhooks at `/api/billing/webhook` and set the signing secret.
4. Test checkout, subscription updates, failed/recovered payments, refunds, disputes, cancellation, and portal access in Stripe test mode before using live keys.

The pricing UI reads amount, currency, and interval from Stripe rather than hard-coding them.

## Brevo email setup

1. Create a Brevo account and add `companionai.email@gmail.com` under **Settings → Senders, Domains & Dedicated IPs → Senders**.
2. Enter the verification code Brevo sends to that Gmail inbox.
3. Create a Brevo API key under **Settings → SMTP & API → API Keys**.
4. Generate a long random `BREVO_WEBHOOK_SECRET`, then add it with `BREVO_API_KEY`, `BREVO_SENDER_EMAIL=companionai.email@gmail.com`, and `BREVO_SENDER_NAME=CompanionAI` to the API service environment.
5. In Brevo transactional webhooks, add `https://YOUR_API_HOST/api/email-webhooks/brevo?secret=YOUR_BREVO_WEBHOOK_SECRET` and subscribe to delivered, hard bounce, soft bounce, blocked, invalid email, spam, and complaint events. Treat the URL as a secret because Brevo webhook configuration does not provide CompanionAI authentication headers.
6. Redeploy and confirm the startup log includes `Brevo API verified: transactional email ready`, then send a test reminder from Profile.

Brevo accepts a verified Gmail sender, but free-email domains cannot be authenticated with DKIM/DMARC and may be rewritten or have poorer deliverability. Move to an authenticated CompanionAI-owned domain before a public launch.

## Production checklist
- Use TLS for MongoDB/Redis; enforce HTTPS, HSTS, and Helmet
- Configure CSP allowlists via `CSP_*` envs and validate the client
- Set up monitoring and alerts for `/health/readiness`, reminder failures, queue failures, and Stripe webhook failures
- See `RUNBOOK.md` for deployment, rollback, health checks, backups, workers, and incident response
- Use `observability/README.md` for Grafana panels, PromQL queries, and production alert thresholds
- Review `SECURITY.md` and publish production-specific privacy, AI-processing, refund, and data-retention policies
- Calibrate system-design AI scores against independent human reviewers before using them in hiring decisions; keep AI output advisory rather than an automatic rejection signal

## Known dependency exception

The current React Router advisory concerns React Server Components action handling. CompanionAI is a client-only BrowserRouter SPA and does not enable React Router framework/RSC actions. CI still fails on critical production advisories, and this exception should be removed when a patched upstream release is available.

License: MIT
