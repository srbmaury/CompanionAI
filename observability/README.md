# CompanionAI observability

The server exports Prometheus metrics at `/metrics` and pushes OTLP metrics when the Grafana environment variables are configured. Route labels use Express route templates and never user IDs or job IDs.

## Recommended dashboard panels

| Panel | PromQL |
| --- | --- |
| Request rate | `sum(rate(http_requests_total[5m])) by (route)` |
| 5xx rate | `sum(rate(http_requests_total{status=~"5.."}[5m])) or vector(0)` |
| p95 latency | `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route))` |
| In-flight requests | `sum(http_requests_in_flight) by (method)` |
| Component readiness | `min(component_ready) by (component)` |
| AI p95 latency | `histogram_quantile(0.95, sum(rate(ai_request_duration_seconds_bucket[10m])) by (le, provider))` |
| AI tokens | `sum(increase(ai_tokens_total[24h])) by (provider, model, type)` |
| Queue depth | `sum(queue_depth{state=~"waiting|active|delayed"}) by (queue, state)` |
| Queue failures | `sum(increase(queue_jobs_total{outcome=~"failed_retryable|dead_letter"}[1h])) by (queue, outcome) or vector(0)` |
| Reminder delivery | `sum(increase(reminder_deliveries_total[24h])) by (outcome) or vector(0)` |
| Reminder p95 lag | `histogram_quantile(0.95, sum(rate(reminder_delivery_lag_seconds_bucket[24h])) by (le))` |
| Stripe webhooks | `sum(increase(billing_webhooks_total[24h])) by (event, outcome) or vector(0)` |
| Funnel | `sum(increase(product_events_total[7d])) by (event, plan) or vector(0)` |
| Interview grounding | `sum(increase(interview_grounding_total[24h])) by (outcome) or vector(0)` |
| Grounding p95 latency | `histogram_quantile(0.95, sum(rate(interview_grounding_duration_seconds_bucket[1h])) by (le))` |
| Authorization denials | `sum(increase(authorization_denied_total[1h])) by (reason, route) or vector(0)` |
| Assessments created | `sum(increase(assessments_total{action="create"}[24h])) by (outcome) or vector(0)` |
| Assessment size | `histogram_quantile(0.50, sum(rate(assessment_questions_bucket[24h])) by (le))` |
| Candidate assessment funnel | `sum(increase(candidate_assessment_actions_total[24h])) by (action, outcome, followups) or vector(0)` |
| Candidate completion p50/p95 | `histogram_quantile(0.50, sum(rate(candidate_assessment_completion_duration_seconds_bucket[24h])) by (le))` and `histogram_quantile(0.95, sum(rate(candidate_assessment_completion_duration_seconds_bucket[24h])) by (le))` |
| Reports viewed | `sum(increase(assessment_reports_viewed_total[24h])) by (has_submissions) or vector(0)` |
| Quota denials | `sum(increase(quotas_denied_total[1h])) by (actionKey) or vector(0)` |

Replace the obsolete CSRF panel with authorization denials; the application uses bearer tokens plus origin checks rather than cookie CSRF middleware.

## Recommended alerts

- Component down: `component_ready == 0` for 5 minutes.
- Elevated 5xx: server errors exceed 2% of requests for 10 minutes, with at least 20 requests.
- API latency: global p95 exceeds 2 seconds for 10 minutes.
- Queue stalled: waiting plus delayed depth exceeds 25 for 10 minutes.
- Dead-letter job: any increase in `queue_jobs_total{outcome="dead_letter"}` over 15 minutes.
- Reminder failure: failure ratio exceeds 10% over 1 hour, with at least 5 attempts.
- Billing failure: any processing failure for a Stripe webhook over 10 minutes.
- AI degradation: failure ratio exceeds 20% over 15 minutes, with at least 10 requests.
- Authentication spike: invalid or blocked login attempts exceed 30 over 10 minutes.
- Candidate funnel degradation: assessment start or submit failures exceed 10% over 30 minutes, with at least 10 actions.
- Assessment abuse pressure: any sustained increase in `quotas_denied_total{actionKey=~"assessment_.*"}` for 15 minutes.
