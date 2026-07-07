# Multi-Agent Architecture

The backend is not one monolith. It is a set of **specialized agents** coordinated by a **Workflow Orchestrator**. This makes new medical specialties additive (register an agent + model module) rather than a refactor.

Pattern: **centralized orchestrator-worker** (the industry-dominant, most debuggable pattern for production medical use) — a planner routes work to specialized workers, aggregates results, enforces policy. Not a free-for-all peer mesh (harder to audit, unacceptable for medical traceability).

---

## The agents

| Agent                       | Responsibility                                                                                                 | Powered by                                                                | Stateless?     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------- |
| **Workflow Orchestrator**   | Plans the pipeline for a request, routes to agents, aggregates, enforces guardrails/policy, writes audit trail | Deterministic Python state machine (not an LLM — predictable & auditable) | yes            |
| **Vision Processing Agent** | Image validation, quality gate, modality detection, preprocessing, ROI/crop, DICOM parsing, tiling (WSI)       | OpenCV, Pillow, MONAI transforms, MediaPipe                               | yes            |
| **Eye Specialist Agent**    | Anterior classifier (scanner) + fundus multi-disease classifier + severity mapping                             | timm/RETFound (ONNX/PyTorch)                                              | yes            |
| **Oncology Agent**          | Skin, brain-MRI, (later) pathology/CT classifiers + severity/risk                                              | EfficientNet/MONAI/nnU-Net/UNI                                            | yes            |
| **Explainability Agent**    | Grad-CAM / Grad-CAM++ / attention rollout / occlusion; heatmap overlay generation                              | pytorch-grad-cam, Captum, MONAI                                           | yes            |
| **Medical Report Agent**    | Assembles structured findings into the clinical report schema; renders PDF                                     | template engine + WeasyPrint; Claude for prose                            | yes            |
| **Patient Education Agent** | Lay-language explanations, causes, lifestyle, medication _education_ (guardrailed)                             | Claude (`claude-sonnet-5`) + curated KB                                   | yes            |
| **Medical Chat Agent**      | Context-aware Q&A grounded in a specific scan's results                                                        | Claude + RAG (see [`07-medical-chat.md`](07-medical-chat.md))             | session-scoped |

**Why some agents are LLM-backed and some are not:** the Orchestrator and Vision Agent must be _deterministic and auditable_ (no LLM). Diagnosis comes from _specialist model agents_ (not the LLM). The LLM only handles **narrative, education, and chat**, always grounded in the specialist agents' structured output. This is the guardrail that keeps medical claims controlled.

---

## Agent contract (uniform interface)

Every worker agent implements one contract, which is what makes the system plug-in:

```python
class AgentRequest(BaseModel):
    request_id: str
    scan_id: str
    task: str                 # e.g. "classify.fundus", "explain.gradcam"
    payload: dict             # image refs, prior results
    context: dict             # user/org, locale, policy flags

class AgentResponse(BaseModel):
    request_id: str
    agent: str
    status: Literal["ok","error","rejected"]
    result: dict              # typed per task
    confidence: float | None
    artifacts: list[str]      # S3 keys (heatmaps, pdf...)
    trace: dict               # timings, model_version, tokens
    error: dict | None

class Agent(Protocol):
    name: str
    capabilities: list[str]           # tasks it can serve
    async def handle(self, req: AgentRequest) -> AgentResponse: ...
    async def healthcheck(self) -> AgentHealth: ...
```

New specialty = new class implementing `Agent` + entry in the **agent registry**. Orchestrator discovers capabilities dynamically.

---

## Communication & data exchange

- **Transport:** internal async messaging over **Redis streams / queue** (Arq) for heavy inference jobs; **direct in-process async calls** for light/fast agents. HTTP/gRPC when an agent is split into its own service for GPU scaling.
- **Envelope:** the `AgentRequest`/`AgentResponse` Pydantic contract above (versioned).
- **Large data by reference, not value:** images/heatmaps/PDFs pass as **S3 keys**, never inline bytes.
- **Standards-aligned:** contract is compatible with **MCP-style** tool exposure and **A2A**-style agent messaging so agents can later be externalized or swapped.
- **Idempotency + tracing:** every message carries `request_id`; all hops recorded to `audit_logs` and OpenTelemetry.

---

## Orchestration process

1. API receives request → creates `scan` → hands `request_id` to **Orchestrator**.
2. Orchestrator selects a **pipeline template** by `module`/`workflow`/`modality`:
   - _Eye upload:_ `Vision → EyeSpecialist → Explainability → Report(+Education)`
   - _Eye scanner frame:_ `Vision(quick) → EyeSpecialist(anterior)` (low-latency, no report until capture)
   - _Cancer upload:_ `Vision → Oncology → Explainability → Report(+Education)`
   - _Chat:_ `MedicalChat` (with scan context loaded)
3. Executes steps (parallel where independent, e.g. Explainability can start once class is known), applies **guardrail checks** (quality gate can reject; low confidence flags "inconclusive").
4. Aggregates into a canonical result, persists `prediction`/`report`, emits SSE progress, writes audit.
5. Failure isolation: any agent error → typed error, partial results preserved, ret/fallback policy per step.

---

## Sequence diagram — Eye upload (full pipeline)

```
User    Web        API/Orchestrator   Vision   EyeSpec   Explain   Report/Edu   Store   DB
 │  upload │            │               │        │         │          │          │      │
 │────────►│  POST scan │               │        │         │          │          │      │
 │         │───────────►│ create scan   │        │         │          │          │─────►│
 │         │            │ presign+store │        │         │          │          │◄─────│
 │         │◄───────────│ scan_id       │        │         │          │          │      │
 │         │ analyze    │               │        │         │          │          │      │
 │         │───────────►│ plan pipeline │        │         │          │          │      │
 │         │            │──────────────►│validate│         │          │          │      │
 │         │            │◄──────────────│ ok/ROI │         │          │          │      │
 │         │            │───────────────────────►│classify │          │          │      │
 │         │            │◄───────────────────────│labels+sev│         │          │      │
 │         │            │─────────────────────────────────►│gradcam  │          │      │
 │         │            │◄─────────────────────────────────│heatmap  │──────────────►│(store)
 │         │            │────────────────────────────────────────────►│narrate+pdf│    │
 │         │            │◄────────────────────────────────────────────│report    │────►│(persist)
 │  SSE: queued→processing→done ◄───────│ aggregate + audit            │          │      │
 │◄────────│ render result + report link│                              │          │      │
```

## Sequence diagram — Realtime scanner frame (low-latency loop)

```
Browser (MediaPipe local)            API/Orchestrator     Vision(quick)   EyeSpec(anterior)
   │ track face/eyes/iris/pose (local, ~30fps, no network)     │              │
   │ user clicks Capture → crop eye ROI                        │              │
   │──────────── POST frame (cropped) ───────────────────────►│              │
   │                                    plan(scanner pipeline) │              │
   │                                    ─────────────────────► │ quality gate │
   │                                    ◄───────────────────── │ ok           │
   │                                    ───────────────────────────────────► │ classify
   │                                    ◄─────────────────────────────────── │ label+conf
   │◄──── result (label, confidence, scope note) ─────────────│ audit        │
```

## Sequence diagram — Context-aware chat

```
User    Chat panel     API      MedicalChatAgent    Retriever(KB+scan)   Claude
 │ ask   │              │             │                    │               │
 │──────►│─ POST msg ──►│──────────► load scan context ──► fetch grounding │
 │       │              │             │◄──────────────────────────────────│ chunks
 │       │              │             │── prompt(context+guardrails) ─────►│
 │       │◄── stream tokens ──────────│◄──────────────────────────────────│ stream
 │◄ stream│             │ append disclaimer + audit                        │
```

---

## Agent-facing internal APIs

Exposed by the agent runtime (internal, behind the API gateway):

```
POST  /agents/dispatch            # orchestrator entrypoint {task, scan_id, payload}
GET   /agents/registry            # capabilities of all registered agents
GET   /agents/{name}/health
POST  /agents/{name}/invoke       # direct single-agent call (admin/debug)
GET   /agents/runs/{request_id}   # trace of an orchestrated run
```

These are internal; the public REST API ([`02-architecture.md`](02-architecture.md)) sits in front and never exposes raw agent calls to clients except via admin/debug scopes.

---

Sources: [Orchestration architectures & protocols (survey)](https://arxiv.org/html/2601.13671v1) · [Multi-agent + RAG medical clinic assistant](https://www.mdpi.com/2079-9292/15/2/334) · [Agent orchestration patterns](https://alicelabs.ai/en/insights/ai-agent-orchestration) · [Multi-agent security (MCP/A2A)](https://arxiv.org/pdf/2505.02077)
