# Roadmap & Implementation Plan (v2)

Revised order per your direction. Each phase is a vertical slice that ends in something demoable, with an approval gate before the next.

---

## Phase 1 — Project Infrastructure _(foundation for everything)_

**Goal:** monorepo + running skeleton + agent framework + design system, with a stub model proving the pipe.

- Monorepo (`apps/web`, `apps/api`, `services/inference`, `services/agents`, `infra`, `packages`).
- Docker Compose: Postgres, Redis, API (FastAPI), agent runtime, inference-stub, web (Next.js).
- **Agent orchestration skeleton** — Workflow Orchestrator + a stub agent, message contracts, job queue (Arq/Redis). See [`05-multi-agent.md`](05-multi-agent.md).
- Auth (Clerk), RBAC scaffold, audit-log middleware.
- Design system tokens, dark/light, shadcn/ui + Framer Motion base. See [`12-uiux-guide.md`](12-uiux-guide.md).
- CI (GitHub Actions): lint, typecheck, test, container scan.
- Health/ready endpoints + OpenAPI + `/metrics`.
  **Demo:** app shell loads, auth works, an image round-trips through the orchestrator to a stub agent and back.

## Phase 2 — AI Eye Scanner (realtime) _(the showcase)_

**Goal:** the signature futuristic scanning experience. Full spec in [`06-eye-scanner.md`](06-eye-scanner.md).

- MediaPipe Face Landmarker + Iris in-browser (WASM); face/eye detection, iris tracking, head-pose estimation.
- HUD: live bounding boxes, animated scan lines, circular HUD rings, confidence indicators, live status messages, scan progress, optional sound.
- Glassmorphism + dark pro theme; smooth Framer Motion; `prefers-reduced-motion` fallback.
- Frame capture → **Vision Agent** (quality/ROI) → **Eye Specialist Agent** (anterior classifier) → live result.
- Honest scoping UI ("upload a fundus image for retinal screening").
  **Demo:** open app → cinematic scan → anterior-segment result. Biggest wow.

## Phase 3 — Eye Image Upload Detection

- Fundus multi-disease model (RETFound research-tier + permissive backbone) on ODIR-5K + APTOS.
- Vision Agent (validation/quality gate) → Eye Specialist Agent (multi-label + severity) → Explainability Agent (Grad-CAM/attention).
- Upload UI, result card, class-distribution chart, heatmap overlay with opacity slider.
  **Demo:** fundus upload → DR/glaucoma/cataract/AMD screen + heatmap.

## Phase 4 — Medical Report Generation

- **Medical Report Agent** assembles structured findings; **Patient Education Agent** supplies lay explanations.
- Professional clinical layout: patient info, image, metadata, findings, confidence, severity, heatmaps, clinical summary, education, follow-up, disclaimer, **QR code**, branding → **PDF export** (WeasyPrint). Full spec [`08-report-generator.md`](08-report-generator.md).
  **Demo:** any analysis → hospital-grade PDF report.

## Phase 5 — AI Medical Chat

- **Medical Chat Agent** grounded in the specific scan's results (RAG over the prediction + report + a curated medical knowledge base). Full spec [`07-medical-chat.md`](07-medical-chat.md).
- Streaming chat panel on every analysis page; suggested prompts; safety guardrails + disclaimers.
  **Demo:** "Explain this disease / why did the AI detect this / what next" answered in-context.

## Phase 6 — Skin Cancer Detection

- **Oncology Agent** + EfficientNet-V2 on HAM10000/ISIC; Grad-CAM. Reuses upload + report + chat.
  **Demo:** skin-lesion classification with heatmap, report, and chat.

## Phase 7 — Brain MRI Detection

- Oncology Agent + 4-class MRI classifier; optional MONAI/nnU-Net segmentation overlay.
  **Demo:** brain-tumor MRI classification/segmentation — proves multi-modality.

## Phase 8 — Admin Dashboard

- Users, orgs, scans, reports, models & versions, API usage, audit logs, analytics, system health, error logs, background jobs, performance metrics. Full spec [`09-admin-dashboard.md`](09-admin-dashboard.md).
  **Demo:** enterprise admin portal.

## Phase 9 — Production Optimization

- AIOps monitoring ([`10-aiops-monitoring.md`](10-aiops-monitoring.md)), caching, rate limiting, load test, full test suite (unit/integration/Playwright e2e), security review, deployment hardening + CI/CD to real infra.
  **Demo:** live URL, dashboards, "here's how it scales and stays safe."

---

## Cross-cutting (built incrementally, not a separate phase)

Responsible-AI guardrails, disclaimers, audit logging, and the plug-in module contract are established in Phase 1 and honored by every subsequent phase.

## Implementation plan mechanics

- **Approval gate** after each phase: I show what's built + how to verify, then wait for your go.
- **Definition of done** per phase: feature works end-to-end, tests green, docs updated, disclaimer/guardrails present, demoable.
- **Reuse-first**: each phase starts by wiring the open-source component before any custom code.
- You may reorder/rescope at any gate.
