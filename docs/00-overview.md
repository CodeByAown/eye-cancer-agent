# AI Healthcare Platform — Planning Dossier (v2)

> **Status:** Pre-implementation. No application code written yet. This is the approved-direction revision incorporating multi-agent architecture, the Eye Scanner showcase, medical chat, report generator, admin portal, AIOps, and a plug-in module system.
> **Product working name:** _(placeholder — e.g. "Lumen Health", "IrisAI", "VisionMD")_
> **Revised:** 2026-07-03 · **Supersedes:** v1

---

## What this platform is now

Not "an AI image classifier with a UI." A **modular, multi-agent AI Healthcare Platform** designed to be demoed to hospitals and enterprise clients, and to grow into a full diagnostic suite (dental, chest X-ray, CT, MRI, histopathology, ECG, blood, OCR, DICOM, radiology…) without re-architecting.

Three pillars:

1. **Signature experience** — a futuristic **AI Eye Scanner** (realtime camera) that makes people say _"this is a real commercial medical AI product."_
2. **Multi-agent brain** — specialized AI agents (vision, eye, oncology, report, explainability, education, chat) coordinated by an orchestrator.
3. **Enterprise skeleton** — admin portal, AIOps monitoring, audit, RBAC, and a plug-in module registry so new specialties drop in.

---

## Guiding principles (unchanged, reaffirmed)

- **Don't reinvent the wheel** — reuse RETFound, MONAI, nnU-Net, pathology foundation models, MediaPipe, `pytorch-grad-cam`, and Claude for narrative/chat. Build orchestration, UX, and glue.
- **Look like a premium SaaS product**, not a demo.
- **Responsible AI first** — educational/decision-support framing, structural disclaimers, never diagnosis.
- **Demo-only licensing scope confirmed** → best research-grade models (RETFound/UNI/Prov-GigaPath) are in play, labeled "research-grade."
- **Plug-in from day one** — every AI capability is an _agent + model module_ behind a stable contract.

---

## The critical clinical constraint (still governs the Eye module)

**Webcam sees only the anterior (front) eye.** The realtime scanner can honestly screen for conjunctivitis, redness, dry-eye signs, visible cataract, styes, and external infections. **Retinal diseases (diabetic retinopathy, glaucoma, AMD, retinal detachment, hypertensive retinopathy, optic disc) require a fundus image** → the upload workflow. The scanner is the showpiece; its verdicts stay scoped, with a "for retinal screening, upload a fundus image" CTA. See [`06-eye-scanner.md`](06-eye-scanner.md).

---

## New implementation order (approved)

1. **Project Infrastructure** → 2. **AI Eye Scanner (realtime)** → 3. **Eye Image Upload Detection** → 4. **Medical Report Generation** → 5. **AI Medical Chat** → 6. **Skin Cancer Detection** → 7. **Brain MRI Detection** → 8. **Admin Dashboard** → 9. **Production Optimization**

Full detail + implementation plan in [`03-roadmap.md`](03-roadmap.md).

---

## Document map (this dossier)

| Doc                                                | Covers                                            | Deliverable(s)                      |
| -------------------------------------------------- | ------------------------------------------------- | ----------------------------------- |
| [`00-overview.md`](00-overview.md)                 | This index + scope                                | —                                   |
| [`01-research.md`](01-research.md)                 | Models, datasets, open-source comparisons         | 1–4                                 |
| [`02-architecture.md`](02-architecture.md)         | System architecture, folder structure, DB, API    | Revised arch, folders, DB, API      |
| [`03-roadmap.md`](03-roadmap.md)                   | 9-phase roadmap + implementation plan             | Updated roadmap, impl plan          |
| [`04-risks-ops.md`](04-risks-ops.md)               | Risks, infra, deployment, scalability             | Risk analysis, scalability          |
| [`05-multi-agent.md`](05-multi-agent.md)           | 8 agents, orchestration, comms, sequence diagrams | Multi-agent arch, sequence diagrams |
| [`06-eye-scanner.md`](06-eye-scanner.md)           | Showcase realtime scanner spec                    | —                                   |
| [`07-medical-chat.md`](07-medical-chat.md)         | Context-aware AI medical chat                     | —                                   |
| [`08-report-generator.md`](08-report-generator.md) | Clinical report layout + PDF/QR/branding          | —                                   |
| [`09-admin-dashboard.md`](09-admin-dashboard.md)   | Admin portal + its DB/API                         | Updated DB/API                      |
| [`10-aiops-monitoring.md`](10-aiops-monitoring.md) | Production AI monitoring / observability          | —                                   |
| [`11-future-expansion.md`](11-future-expansion.md) | Plug-in module system for new specialties         | Future scalability                  |
| [`12-uiux-guide.md`](12-uiux-guide.md)             | Premium UI/UX design system                       | UI/UX design guide                  |
| [`13-tech-review.md`](13-tech-review.md)           | Every tech choice + alternatives                  | Revised tech stack                  |

---

## Approval gate

Review the docs. When you approve, I begin **Phase 1 (Infrastructure)** — repo, monorepo scaffold, Docker Compose, the agent orchestration skeleton, and the design-system foundation — then stop for sign-off before Phase 2 (Eye Scanner). Still no application code until you say go.
