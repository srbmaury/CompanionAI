# CompanionAI

AI‑assisted interview preparation: create multi‑round interviews from a job description, practice answers with voice or code editor, and get automatic feedback.

## Key features
- Authentication: email verification, Google Sign‑In, logout; profile update and password reset
- Resumes: upload to Cloudinary, type/size validation, tags/notes, search/sort, PDF inline preview
- Interview rounds: AI‑suggested rounds from JD; supports conversational and online‑assessment (OA) modes
- Question generation: per‑round question sets with de‑duplication across rounds
- Feedback: per‑question feedback with score and improvement suggestions
- Voice: TTS, STT via server Whisper endpoint with Vosk/Web Speech fallbacks
- Experiences: dedicated page to search web‑shared interview experiences by company and role
- Dashboard pagination: GET /api/interviews supports pagination; dashboard paginates when >10 interviews
- API docs: OpenAPI/Swagger at `/api-docs`

## Architecture
- Client: React (Vite), Material UI, React Router, Axios (with credentials)
- Server: Express, Mongoose (MongoDB), Zod validators, Cloudinary, Nodemailer

Monorepo layout
```
client/                  # React app (Vite, MUI)
server/                  # Express API
  src/
    routes/              # REST routes (auth, interviews, questions, feedback, resumes, stt, run-code, experiences)
    controllers/         # Controllers per domain
    models/              # Mongoose models (User, Resume, Interview, Round, Question, Feedback)
    utils/               # AI, code runner, mailer, parsing, etc.
    config/swagger.js    # OpenAPI config served at /api-docs
```

## Getting started
Prerequisites: Node 18+, MongoDB, Cloudinary account, SMTP (Gmail app password or Mailtrap).
Optional: Judge0 for code execution, OpenAI/Gemini for AI, Redis for quotas/sessions in prod.

1) Install
```bash
cd server && npm i && cd ../client && npm i
```

2) Configure environment

- Server: copy the example and fill required values
  - Minimal required: `MONGO_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`, all `SMTP_*`, all `CLOUDINARY_*`
  - Optional feature flags: `ENABLE_CODE_EXEC`, `ENABLE_STT`, `CAPTCHA_*`, quotas and rate limits
  - Full list and sane defaults live in `server/env.example`
```bash
cp server/env.example server/.env
```

- Client: create `client/.env` and set your client keys
  - Typical: `VITE_API_BASE_URL=/api`
  - If enabling CAPTCHA or Google Sign‑In, set corresponding `VITE_*` keys
  - See `client/README.md` for details

3) Run locally
```bash
# terminal 1
cd server && npm run dev
# terminal 2
cd client && npm run dev
```
Client: http://localhost:5173 • Server: http://localhost:5000

## API and docs
- OpenAPI UI: `GET /api-docs`
- OpenAPI JSON: `GET /api-docs.json`

Highlighted endpoints
- Auth: `/api/auth/*` (register, login, logout, verify-email, resend-verification, forgot/reset-password, profile)
- Interviews: `GET /api/interviews?page&limit` (paginated) · `POST /api/interviews` · `POST /api/interviews/bulk` · `GET /api/interviews/{id}`
- Rounds: `POST /api/rounds/suggest` (AI) · `POST /api/rounds` (manual)
- Questions: `POST /api/questions/{interviewId}/rounds/{roundId}/prepare` · `POST /api/questions/{roundId}/answer` · `POST /api/questions/{roundId}/answers` · `POST /api/questions/{roundId}/complete` · `DELETE /api/questions/{interviewId}/rounds/{roundId}`
- Feedback: `POST /api/feedback/{questionId}` · `GET /api/feedback/{questionId}` · `POST /api/feedback/bulk` · `POST /api/feedback/attach/{roundId}`
- Resumes: `POST /api/resumes` · `GET /api/resumes` (sort/tag/q) · `PUT /api/resumes/{id}` · `DELETE /api/resumes/{id}` · `GET /api/resumes/{id}/preview`
- STT: `POST /api/stt/transcribe` (multipart `audio`)
- Run Code: `POST /api/run-code`
- Experiences: `GET /api/experiences/search?company=&role=`

## Frontend routes
- `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`
- `/dashboard` (paginated interviews)
- `/create-interview`, `/interviews/:interviewId`
- `/experiences` (search interview experiences)
- `/profile`

## Security highlights
- CSRF protection, CORS allowlist, and origin checks by default
- Secure cookies (SameSite, domain) and JWT rotation; per‑user session caps
- Quotas and rate limiting (Redis‑backed) across sensitive routes
- CAPTCHA gates for auth endpoints (recommended in production)
- Code execution via Judge0 is opt‑in and host‑allowlisted
- File uploads validated by magic bytes, size; optional AV scanning
- Metrics endpoint protected by token; structured JSON logging with request IDs

## Production checklist
- Use TLS for MongoDB/Redis; enforce HTTPS, HSTS, and Helmet
- Configure CSP allowlists via `CSP_*` envs and validate the client
- Set up monitoring (Sentry) and import alerts from `server/src/metrics/alerts.yml`
- See `server/RUNBOOK.md` for deployment, rollback, health checks, and hardening

License: MIT
