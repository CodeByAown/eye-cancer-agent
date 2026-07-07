# Implementation Progress Log

Running log of what has been built, key decisions, dependencies, and remaining work. Newest phase at the bottom.

---

## Phase 1 — Foundation · ✅ complete & verified

### Built

- **Monorepo**: pnpm workspace, root tooling (Prettier, EditorConfig, gitignore, `.env.example`), git on `main`.
- **Backend (FastAPI)** — clean-architecture package `apps/api/app`:
  - Config (pydantic-settings), structured logging (structlog + request-id), typed error envelope + handlers.
  - Async SQLAlchemy 2 with a portable `GUID`/`JSONColumn` (Postgres ↔ SQLite), session management, dev auto-create.
  - Domain models: User, Organization, Scan, Prediction, Report, AuditLog, ModelRegistry (+ enums).
  - Auth: Clerk JWT verification (JWKS) + `DEV_AUTH_BYPASS` with JIT user provisioning; RBAC deps.
  - Storage abstraction: `local` + `s3`/R2 behind one interface.
  - Cache/queue client with **automatic in-memory fallback** when Redis is down.
  - **In-process multi-agent runtime**: `BaseAgent`, capability `AgentRegistry`, deterministic `Orchestrator` with declarative pipeline templates, stub Vision + Eye agents (prove the pipe).
  - REST API v1: `/health`, `/ready`, `/me`, `/scans` (upload→analyze→get→list), `/agents/*`, `/files/*`, `/metrics` (Prometheus).
  - Image validation, audit service, request/metrics middleware.
  - Tests (pytest, 6 passing): health, ready, me, metrics, full upload→analyze→retrieve flow, bad-image rejection. Ruff clean.
- **Frontend (Next.js 15 + React 19 + TS)** — `apps/web/src`:
  - Design-token system (HSL vars, dark default + light), Tailwind config, glassmorphism + mesh utilities, reduced-motion.
  - Providers (next-themes + React Query), premium animated landing page, dashboard placeholder, Button/GlassCard/Logo/ThemeToggle primitives.
  - Typecheck + production build + eslint all green.
- **Infra**: `docker-compose.yml` (pgvector Postgres + Redis + api + web), api & web Dockerfiles, GitHub Actions CI (api lint+test, web lint+typecheck+build).

### Verified

- `pytest -q` → 6 passed; `ruff check app` → clean.
- Live `uvicorn` boot: lifespan bootstraps agents + tables, endpoints return 200, dev auth works, OpenAPI lists all routes.
- `pnpm --filter @amvp/web typecheck && build && lint` → all pass.

### Key decisions

- **Docker CLI is not installed on this machine.** Full `docker-compose.yml` is provided for the standard workflow, but the backend also runs **zero-infra**: `DATABASE_URL` defaults to SQLite (`aiosqlite`) and Redis/queue fall back to in-memory implementations when `REDIS_URL` is unreachable. This keeps the app runnable immediately while staying production-shaped (swap env vars → Postgres/Redis, no code change).
- **Auth:** Clerk chosen. Backend verifies Clerk JWTs via JWKS. `DEV_AUTH_BYPASS=true` injects a dev user so the app is usable without a Clerk account during development.
- **Storage abstraction:** `local` (filesystem) and `s3` (S3/R2) backends behind one interface; `local` is the dev default.

### Dependencies (planned this phase)

- API: fastapi, uvicorn, pydantic v2, pydantic-settings, sqlalchemy 2, alembic, asyncpg, aiosqlite, redis, structlog, arq, httpx, pyjwt, prometheus-client, boto3.
- Web: next, react, tailwind, shadcn/ui deps, framer-motion, recharts, @tanstack/react-query, zustand, lucide-react.

### Notes for later

- **In-process agents** live in `apps/api/app/agents/` now (in-process-first per docs/05). They graduate to `services/agents/` as standalone services when GPU scaling demands it — contract unchanged.
- Next.js `output: standalone` is gated behind `NEXT_OUTPUT=standalone` (set in the Docker build) because Windows local builds can't create the symlinks it needs.

---

## Phase 2 — Premium Frontend Framework · _in progress_

### Health check (pre-Phase-2) — done
- Fixed broken `next lint` (pnpm couldn't expose `eslint-visitor-keys`) via `.npmrc` `node-linker=hoisted` + clean reinstall.
- Prettier-formatted repo; untracked pytest `test-storage/` artifacts. All gates green (commit `09abdf8`).

### Built (increment 1 — app shell & component library)
- **App shell**: `(app)` route group with a premium collapsible **Sidebar** (grouped nav, animated active indicator via `layoutId`, compliance footer + disclaimer) and sticky **Topbar** (search affordance w/ ⌘K, system-status badge, notifications, theme toggle, avatar).
- **Reusable component library** (design-system primitives, not page-specific):
  - `ui/`: Button, GlassCard, Card(+Header/Title/Content), Badge, StatusBadge (pulsing dot), Skeleton (shimmer), Tooltip (Radix).
  - `metrics/`: MetricCard (hover glow + delta), ProgressRing (animated SVG), ConfidenceMeter (animated bar, tone by value).
  - `charts/`: ActivityChart (area, gradient fills), ConfidenceTrendChart (line) — Recharts, themed to tokens.
  - `layout/`: Sidebar, Topbar, ComingSoon (elegant placeholder).
- **Premium dashboard** (`/dashboard`): 4 metric cards, scan-activity area chart, confidence-trend + quick actions, recent-analyses table (severity/confidence coloring), AI-models registry health panel — with believable placeholder data (`lib/mock.ts`).
- Placeholder routes (`/eye/scan`, `/eye/upload`, `/reports`) using ComingSoon so nav never 404s.

### Verified
- typecheck / lint / build / prettier all green; dev server boots, all 5 routes return 200.

### New dependencies
- `@radix-ui/react-tooltip`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-avatar`.

### Architectural notes
- Added root `.npmrc` (`node-linker=hoisted`) — required for reliable ESLint under pnpm; CI already uses `--no-frozen-lockfile`.
- Server/Client boundary: pages passing Lucide icon components to client components must be `"use client"` (RSC can't serialize functions).

### AI provider abstraction (increment 2)
- **`app/services/ai/`** — the whole app talks only to **`AIService`**; concrete providers sit behind the `LLMProvider` interface and are chosen by `AI_PROVIDER`.
  - Providers: `OpenAICompatProvider` (covers **OpenAI** [default], Azure OpenAI, Ollama, OpenRouter — shared wire format), `AnthropicProvider`, `GeminiProvider`, `MockProvider`.
  - `factory.build_provider()` selects by env and **falls back to Mock** when the chosen provider has no key (dev/CI-safe, mirrors the Redis fallback). Swapping providers = config only.
  - `AIService.complete()` / `.stream()` — provider-agnostic, with logging + normalized params + token usage. Never leaks an SDK type.
  - httpx-based (no vendor SDKs) → light, uniform, easy to test.
  - Readiness now includes an `ai` check; `.env.example` documents all providers.
  - 11 new tests (factory selection, mock fallback, all providers constructible, service complete/stream) — total **20 passing**, ruff clean.
- Verified live boot: `AI_PROVIDER=openai` with no key → logs fallback, `ready.ai=true`. Add `OPENAI_API_KEY` to go live, no code change.

### API client + live data (increment 3)
- **`lib/api/`**: typed `client.ts` (fetch wrapper — base URL, error-envelope → `ApiError`, pluggable bearer-token getter for auth), `types.ts` (mirrors backend schemas), `hooks.ts` (React Query: `useHealth`, `useReadiness`, `useMe`, `useScans`, `useScan`, `useCreateScan`, `useAnalyzeScan`).
- Topbar now shows **live backend readiness** (`SystemStatus`, tooltip lists each check, degrades gracefully if API down) and the **real signed-in user** (`UserAvatar` via `/me`, dev-bypass provides the dev user).
- `setAuthTokenGetter` seam lets Clerk inject tokens later with zero call-site changes.

### Shared primitives + rebrand (increment 4)
- **Decisions applied**: keep **dev-bypass auth** (Clerk deferred; abstraction retained via `setAuthTokenGetter` + backend `resolve_user`). Working title **"AI Medical Vision Platform"** (dropped "Lumen Health" placeholder; code default + `.env.example` + compose updated — `.env.local` left for user).
- **Primitives** (Phase-3-ready): Toast system (`toast.*` API + animated `Toaster`, Zustand-backed, mounted in Providers), Dialog + Sheet (Radix, tailwindcss-animate), UploadZone (drag/drop + client validation + preview), EmptyState/ErrorState.
- **Mobile responsiveness**: refactored Sidebar → reusable `SidebarContent`; added `MobileNav` (hamburger + slide-in Sheet drawer) wired into Topbar (`md:hidden`).
- New dep: `@radix-ui/react-dialog`.
- Per direction: **stopped** adding dashboard widgets / cosmetic features.

### Auth (deferred by decision)
- Dev-bypass stays; Clerk/Auth.js integration deferred but unblocked (token seam + JIT provisioning already in place).

---

## Phase 3 — AI Eye Scanner (flagship) · _in progress_

### Built (increment 1 — end-to-end scanner)
- **On-device tracking** (`lib/scanner/`, `hooks/`): MediaPipe FaceLandmarker (lazy dynamic import, CDN WASM+model, GPU delegate) → face/eye/**iris** landmarks + **head pose** from the facial transformation matrix. `useCamera` (permissions/stream lifecycle, typed statuses) + `useFaceTracking` (rAF detect loop, stability EMA, luminance-based lighting, fps; writes geometry to a ref for full-fps HUD, throttles a telemetry summary to state).
- **Cinematic HUD** (`ScannerOverlay`, canvas): animated eye reticles with rotating lock rings, iris trackers, face brackets, capture **scan-sweep**, analyzing spinner; searching state; mirrored selfie stage (video+canvas share CSS flip).
- **Lifecycle** (`EyeScanner`): idle → enable-camera (consent copy, on-device emphasis) → initializing (camera+model) → searching → locked → capturing (2.2s progress) → analyzing → result. Graceful **permission-denied / unsupported / error** states with retry; live **TelemetryPanel** (face/lighting/stability/alignment/fps + system log).
- **Capture → inference**: grabs a video frame → `useCreateScan` (module=eye, workflow=scanner) → `useAnalyzeScan` → orchestrator runs `validate.image → classify.anterior` (stub agent) → **ResultCard** (label, ConfidenceMeter, class breakdown, disclaimer + "upload fundus for retinal" CTA). Real MediaPipe UX now; model still stubbed (per plan).
- Scanner route `/eye/scan` replaces the placeholder.

### New dependency
- `@mediapipe/tasks-vision`.

### Verified (this env)
- typecheck / lint / prettier green; production build (pending confirm). **Camera/MediaPipe require a real browser** — to be validated by user; no-camera/denied paths handled gracefully.

### Increment 2 — REAL AI (stub removed)
- **Research**: no plug-and-play permissive anterior-segment weights exist (literature trains custom EfficientNet/MobileNet on datasets like SLID). GPT-4o vision performs credibly on external-eye images. Decision: pluggable `EyeModel` abstraction with **OpenAI-vision as the real default now** (works for webcam capture + uploads → shared code), ONNX/CNN slot reserved for later (unlocks true Grad-CAM).
- **Image pipeline** (`services/imaging.py`, Pillow-only, modular): decode → quality (blur via Laplacian variance + brightness) → region crop → preprocess/downscale → data-URL encode.
- **Eye inference** (`services/eye/`): `EyeModel` contract + `OpenAIVisionEyeModel` (guardrailed medical-screening prompt → strict JSON → `EyeFinding` with label/confidence/severity/observations/rationale/recommendations). Graceful "screening_unavailable" when provider is mock.
- **AI layer gained vision**: `ChatMessage.images` (data URLs) + OpenAI-compat multimodal content; `AIService.complete(..., images=[...])`.
- **Real agents** replace stubs: `VisionAgent` (loads image, quality-gates, REJECTS bad frames) + `EyeSpecialistAgent` (runs EyeModel, emits structured finding + explanation). `stub.py` deleted.
- **Persistence**: `predictions.explanation` JSON column; threaded through orchestrator summary → API schema → frontend `PredictionExplanation`.
- **Scanner ResultCard** now shows the model's rationale ("Why"), observations, class breakdown, and next steps.
- **Verified**: ruff clean, 20 tests pass (AI forced to mock in tests), production build green; **live OpenAI vision confirmed** via direct call AND full HTTP round-trip (upload→analyze→prediction w/ explanation). Synthetic image → "unclear" (correct).

### Increment 3 — implementation correction (user directive)
Decisions: **Local ONNX specialist models** + **cropped-vision scanner (clearly scoped)**; OpenAI for narration only.
- **Routing (#1)**: root cause — links used `/dashboard/*` but routes lived at `/eye/*`,`/reports`. Restructured all routes under `(app)/dashboard/*` (eye/scan, eye/upload, reports, cancer/skin, cancer/brain, admin). Added **automated route-verification** (`scripts/verify-routes.mjs` + `pnpm verify:routes` + CI). All links resolve.
- **Scanner "always unclear" (#2)**: capture now **crops to the eye ROI** from live MediaPipe geometry + upscales; dedicated `OPENAI_VISION_MODEL` (gpt-4o) for image analysis vs gpt-4o-mini for narration.
- **Real specialist model (#4)**: **ONNX Runtime** stack (`services/onnx/`): generic `OnnxImageClassifier` (ImageNet preprocess + softmax + top-k), `ModelSpec` registry with **auto-download/cache** of weights. Integrated **real HAM10000 skin model** (Robobyte/skin-cancer-mobilenet-v3, MobileNetV3, AUC 0.971, ~16MB) — verified real inference (valid distributions, sensible outputs). No torch/TF; pure onnxruntime.
- **Cancer service** (`services/cancer/`): `CancerModel` + `SkinCancerOnnxModel` (severity/malignant framing) + factory by modality. **`OncologyAgent`** (classify.cancer, real ONNX, not LLM) registered. Stubs already gone.
- **Skin Cancer upload module (#3/#8)**: real page via reusable **`UploadAnalysis`** workflow (UploadZone → createScan → analyze → result) + shared **`AnalysisResult`** panel. Verified full HTTP round-trip (upload→validate→ONNX→prediction with malignant/severity).
- **Fundus/eye upload**: wired to `UploadAnalysis`; eye vision model made **scope-aware** (fundus vs anterior prompts/conditions), honestly labeled as vision-based pending a specialist retinal ONNX model.
- **Model responsibility**: skin classification = HAM10000 ONNX CNN; anterior/fundus eye = GPT-4o vision (scoped); narration/report/chat = GPT-4o-mini. Documented in registry `source`/`license`/`commercial_ok`.
- Verified: ruff clean, 20 tests pass, web typecheck/lint/route-verify/build all green; live ONNX skin inference confirmed via direct call + HTTP.

### Remaining (next increments)
- **Grad-CAM** for the skin ONNX CNN (now feasible — `supports_gradcam=true`).
- **Clinical report** generator (Report + Education agents, PDF-ready) — #5.
- **AI Medical Chat** grounded in scan results — #6.
- **Brain MRI** ONNX model; specialist **fundus** ONNX model.
- **Admin dashboard, report history, analytics** — #8.
- Refactor scanner ResultCard to reuse shared `AnalysisResult`.
- More primitives: UploadZone, EmptyState, ErrorState, Dialog/Sheet, Toast/notification system, command palette (⌘K), DiseaseBadge, HeatmapViewer, ImageComparisonSlider, MedicalTimeline.
- Mobile sidebar drawer; per-page skeleton loading states.
- Then → **Phase 3: Eye Scanner**.
