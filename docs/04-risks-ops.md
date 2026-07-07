# Deliverables 12–15: Risks & Limitations, Infrastructure, Deployment, Scalability

---

## Risks and limitations

### Clinical / responsible-AI (highest priority)

- **Not a medical device.** This is an educational / decision-support demo. It is **not** FDA/CE cleared and must never be presented as diagnostic. Every report carries a structural disclaimer; the UI repeats it.
- **Webcam cannot see the retina.** Retinal diseases (DR, glaucoma, AMD, detachment, hypertensive retinopathy, optic disc) require a fundus image. Webcam AI is scoped to anterior-segment findings only. Mislabeling this would be dangerous and dishonest.
- **Distribution shift.** Public-dataset models degrade on real-world images (different cameras, lighting, ethnicity, comorbidities). We surface confidence + quality checks and refuse low-quality inputs rather than guessing.
- **Bias.** Datasets underrepresent skin tones / populations. Document known gaps; never claim demographic-general performance.
- **LLM narrative risk.** Claude could over-state or "hallucinate" clinical claims. Mitigation: it only narrates the model's structured findings; medication content is labeled _educational_; disclaimers are code-appended, not model-generated.
- **Medical chat risk (v2).** The chat agent must not free-lance diagnoses or prescriptions. Mitigation: grounded strictly in the scan's structured results + curated KB (RAG), guardrail system prompt, red-flag → escalate-to-clinician responses, deterministic disclaimer, full audit of prompts/answers ([`07-medical-chat.md`](07-medical-chat.md)).
- **Autonomy risk (v2).** The Orchestrator is a deterministic state machine, **not** an LLM — no agent can invent a pipeline or act outside its declared `capabilities`. Diagnosis comes only from specialist model agents, never the LLM.

### Legal / compliance

- **PHI/HIPAA/GDPR.** For the demo, stay **PHI-light** (no real patient identifiers; synthetic/consented images). If real patient data is ever used: BAAs, encryption at rest/in transit, access controls, data-retention + right-to-erasure, and audit logs (already in schema).
- **Model & dataset licenses.** RETFound, UNI, Virchow2, H-Optimus-0 are **non-commercial**. Commercial deployment must use permissive backbones (timm/EfficientNet/ConvNeXt) or obtain licenses. `model_registry.commercial_ok` enforces this; UI badges "research-grade" models.
- **Webcam consent.** Explicit consent + local-only tracking; capture only on user action.

### Technical

- **GPU cost/availability** for inference (see infra). **Cold starts** on serverless GPU — mitigate with warm pools/keep-alive.
- **Large files** (WSI gigapixel, DICOM series) — handled via presigned uploads + tiling, deferred to later milestones.
- **Latency** for LLM report generation — stream tokens; cache templates; use Sonnet by default.

---

## Infrastructure requirements (estimated)

### Development

- 1 dev machine (your Windows box is fine for frontend/backend). GPU optional locally — training/inference can run on a rented GPU.
- Docker Desktop; a rented **single GPU** (e.g. RTX 4090 / A10 / L4) on Runpod/Vast/Lambda for training + inference dev (~$0.3–1.2/hr).

### Demo / low-traffic production

| Component                                  | Spec                                         | Est. cost                                                  |
| ------------------------------------------ | -------------------------------------------- | ---------------------------------------------------------- |
| Frontend                                   | Vercel Hobby/Pro                             | $0–20/mo                                                   |
| API + workers                              | 1–2 small CPU containers (2 vCPU/4GB)        | $10–40/mo                                                  |
| Inference (light: skin/eye/brain 2D, ONNX) | 1 GPU (L4/A10, 24GB) or CPU for small models | $150–500/mo GPU, or CPU-only ~$20/mo for small ONNX models |
| Postgres                                   | Supabase / Neon managed                      | $0–25/mo                                                   |
| Redis                                      | Upstash/managed                              | $0–10/mo                                                   |
| Object storage                             | Cloudflare R2                                | ~$0.015/GB, no egress                                      |
| LLM (Claude)                               | usage-based                                  | cents per report                                           |
| Monitoring                                 | Sentry free tier + self-host Grafana         | $0–26/mo                                                   |

**Key cost lever:** the MVP models (EfficientNet/ConvNeXt, ~20–90MB, ONNX) run acceptably **on CPU**, so you can demo with **no persistent GPU** and only rent GPU for training or the heavy tiers. This keeps the demo near-free to run.

### Heavy modules (later)

- WSI / 3D CT: 24–48GB GPU (A10/A100/L40S), more storage, batch tiling. Provision on-demand.

---

## Deployment strategy

**Environments:** `local` (compose) → `staging` → `production`.

**Topology:**

- **Frontend:** Vercel (preview deploys per PR, edge CDN).
- **API + workers:** Docker containers on a container host (Fly.io / Render / Railway / AWS ECS) — start here; move to **Kubernetes only when traffic warrants**.
- **Inference:** separate GPU-capable service (same host if CPU models; dedicated GPU node/pool otherwise). ONNX Runtime now, Triton when multi-model batching is needed.
- **DB:** managed Postgres (Neon/Supabase/RDS) with automated backups + PITR.
- **Storage:** R2/S3 with signed URLs + CDN.

**CI/CD (GitHub Actions):**

1. On PR: lint (ruff/eslint), typecheck (mypy/tsc), unit + integration tests, build Docker images, container scan (Trivy), preview deploy.
2. On merge to `main`: build+push images, run Alembic migrations, **blue-green / rolling** deploy, smoke test `/ready`, notify.

- Secrets in GitHub Encrypted Secrets / cloud secret manager. Model weights via **DVC or S3** (never in git).

**Release safety:** health/readiness probes, migration gating, automatic rollback on failed smoke test, feature flags for new modules.

---

## Scalability plan

- **Stateless API + workers** → horizontal autoscale behind a load balancer.
- **Inference decoupled via queue** → scale GPU workers independently of API; batch requests via Triton dynamic batching.
- **Model serving tiers:** small models on CPU/edge (even ONNX Runtime Web in-browser for the anterior classifier later); heavy models on GPU pools with autoscaling + scale-to-zero for cost.
- **DB:** read replicas + connection pooling (PgBouncer); partition `audit_logs`/`scans` by time; pgvector index for future image-similarity search.
- **Caching:** Redis for repeated inferences (hash of image → result), report templates, and session data; CDN for static + heatmaps/PDFs.
- **Multi-tenancy:** `organizations` table already present → row-level isolation, per-org rate limits and quotas, later per-org model configs.
- **Observability at scale:** OpenTelemetry traces, Prometheus histograms per model (latency, confidence distribution), Evidently for data/model drift with alerting → triggers retraining pipeline.
- **MLOps:** DVC-versioned datasets + model_registry governance → reproducible retraining, canary model rollouts (`model_registry.active` + traffic split), shadow evaluation before promotion.

### Multi-agent scalability (v2)

- **Agents are stateless workers** behind the Orchestrator → each agent scales independently; hot agents (Vision, Specialists) get more replicas; GPU agents pool separately from CPU agents.
- **Orchestrator is horizontally scalable** (deterministic, no shared mutable state; run state persisted per `request_id`).
- **Split-on-demand:** agents start in-process; any agent can graduate to its own service (HTTP/gRPC) without contract changes when it needs isolated GPU scaling.
- **Plug-in modules** (see [`11-future-expansion.md`](11-future-expansion.md)) add load additively — new agent + model, same infra.
- **LLM agents** (chat/report/education) scale via provider concurrency + prompt caching; cost-bounded by Sonnet default and cached KB/system prompts.

---

## Resolved & open decisions

**Resolved:**

- **Commercial scope → DEMO-ONLY** (confirmed) ⇒ research-grade models (RETFound/UNI/Prov-GigaPath) permitted, labeled "research-grade."
- **Module order → Eye Scanner first** (confirmed; see [`03-roadmap.md`](03-roadmap.md)).

**Open (my recommendations):**

1. **Auth:** Clerk (recommended, fast/polished) vs Auth.js (self-hosted/sovereign).
2. **GPU:** CPU-only for MVP (recommended — MVP models are small) vs rent-on-demand vs always-on.
3. **Product/brand name + logo** (needed for report branding in Phase 4).
