# Production AI Monitoring (AIOps)

A dedicated observability layer for the AI system, distinct from generic app monitoring — because in a medical product, _model_ behavior must be watched as closely as _infrastructure_.

## What we monitor

| Signal                    | Metric                                         | Source                       | Alert when                           |
| ------------------------- | ---------------------------------------------- | ---------------------------- | ------------------------------------ |
| **Inference latency**     | p50/p95/p99 per model                          | inference service histograms | p95 > SLO (e.g. 2s)                  |
| **Model health**          | up/down, load status, version served           | agent healthchecks           | any model down                       |
| **Model version**         | active version per module, drift from expected | model_registry               | unexpected version                   |
| **Prediction confidence** | rolling distribution per model                 | prediction stream            | mean confidence drops (drift signal) |
| **Error rate**            | inference/agent errors %                       | logs + counters              | > threshold                          |
| **Request throughput**    | req/s per endpoint & model                     | API metrics                  | anomalous spike/drop                 |
| **Queue status**          | depth, oldest job age, failures                | Arq/Redis                    | backlog growing                      |
| **API latency**           | p95 per endpoint                               | API middleware               | SLO breach                           |
| **System uptime**         | service availability                           | health probes                | any service down                     |
| **Resource utilization**  | CPU/GPU/mem/disk                               | node exporter / DCGM         | saturation                           |

## Stack

- **Metrics:** Prometheus scrapes `/metrics` from API, agents, inference (GPU via **DCGM exporter**). **Grafana** dashboards.
- **Tracing:** OpenTelemetry across API → orchestrator → agents → inference (per-`request_id`).
- **Logs:** structured JSON (loguru/structlog) → Loki (or ELK).
- **Errors:** Sentry (frontend + backend).
- **Model/data drift:** **Evidently** — monitors input distribution and confidence/output drift; scheduled reports + alerts.
- **Uptime:** external synthetic checks (health/ready) + status page.

## Dashboards (Grafana)

1. **AI Overview** — throughput, latency, error rate, active models.
2. **Per-Model** — latency histogram, confidence distribution, request volume, version.
3. **Queue & Jobs** — depth, age, retries, failure rate.
4. **Infra** — CPU/GPU/mem/disk, pod/container health.
5. **Drift** — Evidently input/output drift over time.

## Alerting

Alertmanager → Slack/email/PagerDuty. Tiered: page on service-down / SLO breach; warn on drift / rising error rate / queue backlog.

## Model governance loop

Confidence-drift or accuracy-regression alert → flag in admin → trigger re-evaluation → shadow-test candidate → canary rollout (`model_registry.active` + traffic split) → promote or rollback. Every model change is audit-logged.

## Future observability tooling (recommendations)

- **Arize / WhyLabs / Fiddler** — dedicated ML observability at scale.
- **NVIDIA Triton metrics** — when serving consolidates on Triton.
- **LangSmith / Langfuse** — LLM tracing for the chat/report/education agents (prompt, tokens, cost, latency, quality evals).
- **OpenTelemetry → Tempo/Jaeger** — distributed trace storage.
