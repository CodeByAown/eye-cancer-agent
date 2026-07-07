# Architecture, Folder Structure, DB Schema, API, Wireframes (v2 — multi-agent)

> v2 adds the **multi-agent orchestration layer** ([`05-multi-agent.md`](05-multi-agent.md)), **admin portal** ([`09-admin-dashboard.md`](09-admin-dashboard.md)), **medical chat** ([`07-medical-chat.md`](07-medical-chat.md)), **report generator** ([`08-report-generator.md`](08-report-generator.md)), and **plug-in modules** ([`11-future-expansion.md`](11-future-expansion.md)). Tech justification moved to [`13-tech-review.md`](13-tech-review.md); UI/UX to [`12-uiux-guide.md`](12-uiux-guide.md).

---

## System architecture

```
   ┌────────────────────────────── CLIENT (browser) ──────────────────────────────┐
   │ Next.js 15 · React · TS · Tailwind · shadcn/ui · Framer Motion · Recharts     │
   │ ┌─────────────┐ ┌──────────────┐ ┌───────────┐ ┌────────────┐ ┌───────────┐  │
   │ │ Eye Scanner │ │ Upload /     │ │ Report    │ │ Chat panel │ │ Admin     │  │
   │ │ (MediaPipe, │ │ Dashboard    │ │ viewer    │ │            │ │ portal    │  │
   │ │  WASM local)│ └──────────────┘ └───────────┘ └────────────┘ └───────────┘  │
   │ └──────┬──────┘        capture frame / file / question / admin ops            │
   └────────┼──────────────────────────────┬───────────────────────────────────────┘
            │  HTTPS (JWT · Clerk)          ▼
   ┌───────────────────────── API GATEWAY (FastAPI) ──────────────────────────────┐
   │ auth · RBAC · rate limit · validation · audit · OpenAPI · SSE · /metrics       │
   └───────────────────────────────┬───────────────────────────────────────────────┘
                                    ▼
   ┌───────────────────── WORKFLOW ORCHESTRATOR (deterministic) ───────────────────┐
   │ selects pipeline template · routes to agents · aggregates · guardrails · audit │
   └───┬──────────┬──────────┬───────────┬───────────┬───────────┬─────────────────┘
       ▼          ▼          ▼           ▼           ▼           ▼
  ┌─────────┐┌─────────┐┌──────────┐┌──────────┐┌──────────┐┌──────────────┐
  │ Vision  ││ Eye     ││ Oncology ││ Explain- ││ Report + ││ Medical Chat │
  │ Agent   ││Specialist││ Agent   ││ ability  ││ Education││ Agent (RAG)  │
  │(OpenCV/ ││(timm/   ││(EffNet/ ││ Agent    ││ Agents   ││              │
  │ MONAI)  ││RETFound)││MONAI/UNI)││(gradcam) ││(Claude+  ││(Claude+      │
  └────┬────┘└────┬────┘└────┬─────┘└────┬─────┘│WeasyPrint)││ pgvector)    │
       │          │          │           │      └────┬─────┘└──────┬───────┘
       │      ┌───▼──────────▼───────────▼───┐       │             │
       │      │  INFERENCE RUNTIME (CPU/GPU)  │       │             │
       │      │ ONNX Runtime / Triton · PyTorch│      │             │
       │      └───────────────┬───────────────┘       │             │
       ▼                      ▼                        ▼             ▼
  ┌──────────────┐   ┌──────────────┐          ┌──────────────────────────────┐
  │ Object Store │   │ Job Queue    │          │ PostgreSQL (+ pgvector)        │
  │ S3/R2 + CDN  │   │ Redis + Arq  │          │ users·orgs·scans·predictions·  │
  │ img/maps/pdf │   └──────────────┘          │ reports·chat·kb·audit·models·  │
  └──────────────┘                             │ api_usage·jobs·model_metrics   │
                                               └──────────────────────────────┘
  Cross-cutting AIOps: Sentry · Prometheus/Grafana · OpenTelemetry · Evidently · JSON logs
```

**Request lifecycle (upload):** client uploads → API validates + stores original (S3) → Orchestrator runs `Vision → Specialist → Explainability → Report(+Education)` across agents (heavy steps via queue) → prediction + heatmap + PDF persisted → SSE progress → dashboard renders. Full sequence diagrams in [`05-multi-agent.md`](05-multi-agent.md).

**Request lifecycle (scanner):** MediaPipe runs fully in-browser (no video leaves device); on Capture, one cropped eye ROI → Orchestrator `Vision(quick) → EyeSpecialist(anterior)` → low-latency result.

**Request lifecycle (chat):** question + scan_id → Medical Chat Agent loads scan context + retrieves KB (pgvector) → Claude streams grounded answer + disclaimer.

---

## Tech justification

Full technology review — every choice, rationale, and alternatives considered — now lives in **[`13-tech-review.md`](13-tech-review.md)**. Summary: the v1 stack (Next.js/React/TS/Tailwind/FastAPI/Postgres/Redis/Docker/MediaPipe/OpenCV/PyTorch/HF/ONNX/Framer Motion/Clerk) is confirmed; v2 adds shadcn/ui, MONAI+nnU-Net, Arq, WeasyPrint, pgvector, Triton (at scale), and the AIOps stack.

> **Still-open decision:** **Clerk vs Auth.js** — recommend Clerk for the demo timeline.

---

## Folder structure (monorepo)

```
ai-medical-vision/
├─ docs/                         # this dossier
├─ apps/
│  ├─ web/                       # Next.js 15 frontend
│  │  ├─ app/                    # App Router
│  │  │  ├─ (marketing)/         # landing, pricing
│  │  │  ├─ (dashboard)/         # authed app
│  │  │  │  ├─ eye/scan/         # realtime Eye Scanner (showcase)
│  │  │  │  ├─ eye/upload/       # fundus upload
│  │  │  │  ├─ cancer/           # skin, brain-mri
│  │  │  │  ├─ reports/[id]/     # report viewer
│  │  │  │  └─ chat/             # (chat panel embedded per-analysis)
│  │  │  ├─ (admin)/             # admin portal (RBAC-gated)
│  │  │  └─ api/                 # BFF routes (proxy, webhooks)
│  │  ├─ components/             # ui/, scanner/ (HUD), charts/, report/, chat/, admin/
│  │  ├─ lib/                    # api client, mediapipe, hooks
│  │  └─ styles/
│  └─ api/                       # FastAPI backend (API gateway)
│     ├─ app/
│     │  ├─ main.py
│     │  ├─ core/                # config, security, RBAC, logging
│     │  ├─ api/v1/              # routers: auth, scans, predictions, reports, chat, admin
│     │  ├─ services/            # image, storage, report, chat, orchestrator client
│     │  ├─ models/              # SQLAlchemy models
│     │  ├─ schemas/             # Pydantic (incl. Agent contract)
│     │  ├─ workers/             # Arq tasks
│     │  └─ db/                  # session, migrations (alembic/)
│     └─ tests/
├─ services/
│  ├─ agents/                    # multi-agent runtime (see 05-multi-agent.md)
│  │  ├─ orchestrator/           # Workflow Orchestrator (pipeline templates)
│  │  ├─ base/                   # Agent protocol, contract, registry
│  │  ├─ vision/                 # Vision Processing Agent
│  │  ├─ eye/                    # Eye Specialist Agent
│  │  ├─ oncology/               # Oncology Agent
│  │  ├─ explain/                # Explainability Agent
│  │  ├─ report/                 # Medical Report + Patient Education Agents
│  │  └─ chat/                   # Medical Chat Agent (RAG)
│  └─ inference/                 # model runtime (CPU/GPU)
│     ├─ modules/                # plug-in modules (each with module.manifest.yaml)
│     │  ├─ eye_anterior/  eye_fundus/  skin/  brain_mri/  ...
│     ├─ registry/               # model loading, ONNX/Triton
│     └─ weights/                # (gitignored; DVC/S3-tracked)
├─ packages/
│  ├─ ui/                        # shared design system (design tokens, components)
│  └─ types/                     # shared TS types generated from OpenAPI
├─ infra/
│  ├─ docker/                    # Dockerfiles
│  ├─ compose/                   # docker-compose.*.yml
│  ├─ k8s/                       # manifests/helm (later)
│  └─ terraform/                 # cloud (later)
├─ ml/                           # training notebooks, DVC pipelines, DATASETS.md
├─ .github/workflows/            # CI/CD
└─ README.md
```

---

## Database schema

Core tables (PostgreSQL). Model outputs stored as JSONB for flexibility; key fields promoted to columns for querying.

```sql
-- users mirror Clerk (or Auth.js) identity
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id   TEXT UNIQUE NOT NULL,        -- Clerk user id
  email         CITEXT UNIQUE NOT NULL,
  full_name     TEXT,
  role          TEXT NOT NULL DEFAULT 'clinician_demo', -- admin|clinician_demo|viewer
  org_id        UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, plan TEXT DEFAULT 'demo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- one row per uploaded/captured image
CREATE TABLE scans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  module        TEXT NOT NULL,               -- 'eye' | 'cancer'
  workflow      TEXT NOT NULL,               -- 'webcam' | 'upload'
  modality      TEXT,                        -- 'fundus'|'anterior'|'dermoscopy'|'mri'|'ct'|'wsi'
  source_uri    TEXT NOT NULL,               -- S3 key of original
  status        TEXT NOT NULL DEFAULT 'queued', -- queued|processing|done|failed
  validation    JSONB,                       -- quality checks, is_valid, reasons
  meta          JSONB,                       -- exif, dims, capture params
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON scans (user_id, created_at DESC);

-- inference result(s) for a scan
CREATE TABLE predictions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id       UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  model_name    TEXT NOT NULL,
  model_version TEXT NOT NULL,
  top_label     TEXT NOT NULL,
  top_confidence NUMERIC(5,4) NOT NULL,
  severity      TEXT,                         -- none|mild|moderate|severe
  classes       JSONB NOT NULL,              -- [{label, prob}]
  heatmap_uri   TEXT,                        -- S3 key of Grad-CAM overlay
  latency_ms    INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON predictions (scan_id);

-- narrated clinical report (LLM + template)
CREATE TABLE reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id       UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  prediction_id UUID NOT NULL REFERENCES predictions(id),
  narrative     JSONB NOT NULL,              -- {explanation, causes, risk_factors,
                                             --  recommendations, lifestyle, next_steps,
                                             --  medication_education, urgency, disclaimer}
  llm_model     TEXT, llm_prompt_version TEXT,
  pdf_uri       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- immutable audit trail (medical requirement)
CREATE TABLE audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    UUID,
  action      TEXT NOT NULL,                 -- login|scan.create|prediction.view|report.export...
  entity      TEXT, entity_id UUID,
  ip          INET, user_agent TEXT,
  detail      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON audit_logs (actor_id, created_at DESC);

-- model registry (governance)
CREATE TABLE model_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT, version TEXT, module TEXT, modality TEXT,
  license TEXT, commercial_ok BOOLEAN,
  metrics JSONB, weights_uri TEXT, artifact_hash TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Design notes:** `scans → predictions → reports` is a clean 1→N→1 chain. `audit_logs` is append-only. Consent for webcam capture is recorded in `scans.meta`. No raw patient identifiers required for the demo (keep it PHI-light).

---

## API design (REST, versioned, OpenAPI-documented)

```
Auth (via Clerk JWT; backend verifies)
  POST   /api/v1/auth/webhook            # Clerk user sync
  GET    /api/v1/me

Scans & inference
  POST   /api/v1/scans                   # multipart upload OR presign request → returns scan_id, upload_url
  POST   /api/v1/scans/{id}/analyze      # enqueue inference (module/modality)
  GET    /api/v1/scans/{id}              # status + validation
  GET    /api/v1/scans/{id}/prediction   # prediction + heatmap URL
  GET    /api/v1/scans?module=&page=     # history (paginated)

Realtime status
  GET    /api/v1/scans/{id}/events       # SSE stream: queued→processing→done

Reports
  POST   /api/v1/reports                 # generate narrative for a prediction
  GET    /api/v1/reports/{id}
  GET    /api/v1/reports/{id}/pdf        # signed download

Models (admin)
  GET    /api/v1/models
  POST   /api/v1/models/{id}/activate

System
  GET    /api/v1/health                  # liveness
  GET    /api/v1/ready                   # readiness (db, redis, gpu)
  GET    /metrics                        # Prometheus
```

**Standards:** Pydantic request/response schemas; consistent error envelope `{error:{code,message,details}}`; rate limiting (SlowAPI/Redis) per-user + per-IP; idempotency keys on `POST /scans`; presigned S3 uploads so large files bypass the API; SSE for live progress in the scanner/upload UIs.

---

## UI/UX wireframes (low-fi)

**Landing (marketing):** hero with animated scanner mockup, module cards, trust/disclaimer band, dark/light toggle.

**Dashboard shell:**

```
┌─────────────────────────────────────────────────────────────┐
│ ◐ Lumen   [Dashboard][Eye][Cancer][Reports]      ☾/☀  ⌂ user │
├──────────┬──────────────────────────────────────────────────┤
│ Sidebar  │  Overview                                         │
│ • Home   │  ┌─stat─┐┌─stat─┐┌─stat─┐┌─stat─┐                 │
│ • Eye    │  │Scans ││Avg   ││Flags ││Reports│                │
│ • Cancer │  │  128 ││conf  ││  3   ││  57  │                 │
│ • Reports│  └──────┘└──────┘└──────┘└──────┘                 │
│ • Admin  │  ┌── recent scans table ──────────────────────┐   │
│          │  │ thumb | module | result | conf | date | ▸ │   │
│          │  └───────────────────────────────────────────┘   │
└──────────┴──────────────────────────────────────────────────┘
```

**Eye — Webcam Scanner (the showpiece):**

```
┌──────────────── LIVE SCAN ─────────────────┐   ┌─ Telemetry ─────┐
│   ╔═══════════════════════════════════╗     │   │ Face:   locked  │
│   ║   [webcam feed]                    ║     │   │ L-eye:  tracked │
│   ║     ◜ ◝  reticle over each eye     ║     │   │ R-eye:  tracked │
│   ║   ( ◉ )     ( ◉ )                  ║     │   │ Stability: 92%  │
│   ║   ◟ ◞   scanning sweep line ▁▂▃▄▅  ║     │   │ Lighting: good  │
│   ╚═══════════════════════════════════╝     │   │ ─────────────── │
│   [ ● Capture & Analyze ]  confidence ▮▮▮▯   │   │ live class:     │
└─────────────────────────────────────────────┘   │  normal  0.71   │
   glassmorphic HUD, neon reticles, grid overlay   └─────────────────┘
```

**Upload workflow / result:**

```
┌ drop zone (drag fundus/skin/MRI) ┐   ┌ Result ───────────────────────┐
│  ⬆ drag & drop or browse          │   │ image | Grad-CAM overlay ◐slider│
│  supports: jpg/png/dicom/svs      │   │ Disease: Moderate DR           │
└───────────────────────────────────┘   │ Confidence ▮▮▮▮▮▮▮▯ 83%         │
   skeleton loaders while processing     │ Severity: ●●●○○  Moderate      │
                                         │ [class distribution bar chart] │
                                         │ ▸ Full clinical report          │
                                         └────────────────────────────────┘
```

**Report view:** medical-letterhead styling, sections (Findings → Confidence → Severity → Causes → Clinical explanation → Risk factors → Recommendations → Lifestyle → Next steps → Urgency flag → Medication education → **Disclaimer**), "Export PDF" + "Share" (signed link).

Design system: Inter/Geist type, medical teal+indigo accents, generous spacing, glassmorphism on overlays only (not everywhere), full dark/light, WCAG-AA contrast, skeleton loaders + progress everywhere, respect `prefers-reduced-motion`.

> When we reach the UI milestone, I can generate high-fidelity mockups in **Figma** (via the Figma MCP) or a clickable HTML prototype **Artifact** for your sign-off before building.
