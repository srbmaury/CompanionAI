# CompanionAI Product Architecture

CompanionAI is intentionally exposed as two separate products while retaining one shared platform underneath.

## Product surfaces

### CompanionAI Practice

Canonical routes live under `/practice`.

Purpose:
- private candidate interview preparation
- resume and job-description context
- adaptive conversational, coding, and system-design practice
- feedback, competency evidence, and progress tracking
- candidate-owned Practice billing

Primary home: `/practice/dashboard`

### CompanionAI Hire

Canonical routes live under `/hire`.

Purpose:
- organization-owned technical assessments
- candidate invitations and pipeline
- evidence-rich reports
- team access, SSO, and organization billing
- human review and AI/human calibration

Primary home: `/hire/assessments`

Public candidate assessment links remain neutral under `/assessment/:shareToken`. A candidate invited by an employer does not enter the personal Practice product or the recruiter Hire product.

## Why this is one repository

The two products deliberately share:
- authentication and account identity
- the adaptive interview engine
- question/evaluation primitives
- security controls
- observability
- calibration infrastructure
- common design-system components

Duplicating those capabilities into independent repositories would increase security risk, create evaluator drift, and force the most complex interview logic to be maintained twice.

The split therefore happens at the product boundary, not the core-engine boundary.

## Isolation rules

1. Practice routes must use the `/practice/...` namespace.
2. Hire routes must use the `/hire/...` namespace.
3. Practice copy must speak only to candidates and personal preparation.
4. Hire copy must speak only to hiring teams and organization workflows.
5. Work SSO belongs to Hire authentication, not Practice authentication.
6. Hiring data remains organization-owned and role-gated.
7. Practice data remains user-owned.
8. Cross-product switching is secondary account navigation, not the primary information architecture.
9. AI hiring scores are supporting evidence; employment decisions remain human-controlled.
10. Legacy paths are redirects only and must canonicalize to the correct product namespace.

## Legacy URL compatibility

Existing bookmarks and old internal links continue to work. Examples:

- `/dashboard` -> `/practice/dashboard`
- `/create-interview` -> `/practice/new`
- `/interviews/:id` -> `/practice/interviews/:id`
- `/assessments` -> `/hire/assessments`
- `/assessments/:id` -> `/hire/assessments/:id`
- `/hiring/team` -> `/hire/team`

This lets the migration happen without breaking saved links, emails, or existing browser history.

## Deployment path

The current route separation is designed so deployment can later move to subdomains without forking the application:

- `practice.<domain>` -> Practice surface
- `hire.<domain>` -> Hire surface
- `<domain>` -> CompanionAI product-family gateway

Both product deployments can use the same client build and backend API initially. If scale or enterprise isolation later justifies separate deploy artifacts, the route and product boundaries already exist and can be split at the deployment layer without rewriting interview logic.

## Product strategy

Practice is the candidate acquisition and learning product.

Hire is the higher-value B2B product and should receive most commercial investment. Its differentiation should focus on quality of hiring signal per interviewer-hour: adaptive competency coverage, evidence collection, calibration, disagreement analysis, and transparent human review—not simply the ability to generate interview questions with an LLM.
