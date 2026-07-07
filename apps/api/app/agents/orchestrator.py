"""Workflow Orchestrator.

A DETERMINISTIC state machine (not an LLM) that selects a pipeline template for
a request, dispatches tasks to capable agents via the registry, threads results
between steps, applies guardrails, and aggregates a canonical result.

This is the guardrail boundary: diagnosis only ever comes from specialist model
agents; the orchestrator never invents a pipeline or a finding.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.agents.registry import AgentRegistry, get_registry
from app.core.logging import get_logger
from app.schemas.agent import AgentRequest, AgentResponse, AgentStatus

log = get_logger("orchestrator")


@dataclass(frozen=True)
class PipelineStep:
    task: str
    optional: bool = False  # if True, failure does not abort the pipeline


@dataclass(frozen=True)
class Pipeline:
    name: str
    steps: list[PipelineStep] = field(default_factory=list)


# Declarative pipeline templates. New modules add templates here (or via the
# plug-in module manifest in later phases) — no orchestrator code changes.
PIPELINES: dict[str, Pipeline] = {
    "eye.scanner": Pipeline(
        "eye.scanner",
        [PipelineStep("validate.image"), PipelineStep("classify.anterior")],
    ),
    "eye.upload": Pipeline(
        "eye.upload",
        [
            PipelineStep("validate.image"),
            PipelineStep("classify.fundus"),
            PipelineStep("explain.gradcam", optional=True),
        ],
    ),
    "cancer.upload": Pipeline(
        "cancer.upload",
        [
            PipelineStep("validate.image"),
            PipelineStep("classify.cancer"),
            PipelineStep("explain.gradcam", optional=True),
        ],
    ),
}


def select_pipeline(module: str, workflow: str) -> Pipeline:
    key = f"{module}.{workflow}"
    if key not in PIPELINES:
        # Fall back to a sane default per module.
        key = "eye.upload" if module == "eye" else "cancer.upload"
    return PIPELINES[key]


@dataclass
class OrchestrationResult:
    request_id: str
    pipeline: str
    status: str  # ok | rejected | error
    steps: list[AgentResponse]
    summary: dict

    @property
    def final(self) -> AgentResponse | None:
        # The last non-optional classification response carries the verdict.
        for resp in reversed(self.steps):
            if resp.status == AgentStatus.OK and "top_label" in resp.result:
                return resp
        return None


class Orchestrator:
    def __init__(self, registry: AgentRegistry | None = None) -> None:
        self.registry = registry or get_registry()

    async def run(
        self,
        *,
        request_id: str,
        module: str,
        workflow: str,
        scan_id: str | None = None,
        payload: dict | None = None,
        context: dict | None = None,
    ) -> OrchestrationResult:
        pipeline = select_pipeline(module, workflow)
        payload = dict(payload or {})
        context = dict(context or {})
        steps: list[AgentResponse] = []
        status = "ok"

        log.info("pipeline_start", pipeline=pipeline.name, request_id=request_id)

        for step in pipeline.steps:
            try:
                agent = self.registry.for_task(step.task)
            except Exception as exc:
                if step.optional:
                    log.info("step_skipped_no_agent", task=step.task)
                    continue
                log.warning("step_no_agent", task=step.task, error=str(exc))
                status = "error"
                break

            req = AgentRequest(
                request_id=request_id,
                scan_id=scan_id,
                task=step.task,
                payload=payload,
                context=context,
            )
            resp = await agent.run(req)
            steps.append(resp)

            # Guardrail: a rejected validation aborts the pipeline.
            if resp.status == AgentStatus.REJECTED:
                status = "rejected"
                break
            if resp.status == AgentStatus.ERROR and not step.optional:
                status = "error"
                break

            # Thread this step's result forward so later agents can use it.
            payload.setdefault("prior", {})[step.task] = resp.result

        result = OrchestrationResult(
            request_id=request_id,
            pipeline=pipeline.name,
            status=status,
            steps=steps,
            summary=self._summarize(steps),
        )
        log.info("pipeline_end", pipeline=pipeline.name, status=status, request_id=request_id)
        return result

    @staticmethod
    def _summarize(steps: list[AgentResponse]) -> dict:
        for resp in reversed(steps):
            if resp.status == AgentStatus.OK and "top_label" in resp.result:
                return {
                    "top_label": resp.result.get("top_label"),
                    "confidence": resp.confidence,
                    "severity": resp.result.get("severity"),
                    "classes": resp.result.get("classes", []),
                    "model_name": resp.result.get("model_name"),
                    "model_version": resp.result.get("model_version"),
                    "explanation": resp.result.get("explanation"),
                }
        return {}


_orchestrator: Orchestrator | None = None


def get_orchestrator() -> Orchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = Orchestrator()
    return _orchestrator
