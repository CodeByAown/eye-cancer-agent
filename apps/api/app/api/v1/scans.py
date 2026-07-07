"""Scan lifecycle: upload → analyze (via orchestrator) → retrieve."""

from __future__ import annotations

import uuid
from decimal import Decimal

from fastapi import APIRouter, File, Form, Query, Request, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.orchestrator import get_orchestrator
from app.api.deps import CurrentUserDep, SessionDep
from app.core.errors import NotFoundError, ValidationAppError
from app.core.logging import get_logger
from app.models.enums import Module, ScanStatus, Workflow
from app.models.scan import Prediction, Report, Scan
from app.observability.metrics import inference_confidence
from app.schemas.common import Page
from app.schemas.scan import PredictionPublic, ReportPublic, ScanPublic, ScanWithResult
from app.services import audit
from app.services.images import guess_extension, validate_image
from app.services.report import generate_report_narrative
from app.services.storage import get_storage

router = APIRouter(tags=["scans"])
log = get_logger("scans")


async def _load_scan(session: AsyncSession, scan_id: uuid.UUID, user_id: uuid.UUID) -> Scan:
    scan = await session.get(Scan, scan_id)
    if scan is None or scan.user_id != user_id:
        raise NotFoundError("Scan not found.")
    return scan


@router.post("/scans", response_model=ScanPublic, status_code=201)
async def create_scan(
    request: Request,
    session: SessionDep,
    user: CurrentUserDep,
    file: UploadFile = File(...),
    module: Module = Form(...),
    workflow: Workflow = Form(...),
    modality: str | None = Form(default=None),
) -> ScanPublic:
    """Upload (or capture) an image and create a scan record."""
    data = await file.read()
    meta = validate_image(data)  # raises ValidationAppError on bad input

    key = f"scans/{uuid.uuid4()}.{guess_extension(meta['format'])}"
    storage = get_storage()
    stored = await storage.put(key, data, content_type=file.content_type or "image/jpeg")

    scan = Scan(
        user_id=user.id,
        module=module,
        workflow=workflow,
        modality=modality,
        source_uri=stored.key,
        status=ScanStatus.QUEUED,
        validation={"is_valid": True, **meta},
        meta={"filename": file.filename, "content_type": file.content_type},
    )
    session.add(scan)
    await session.flush()

    await audit.record(
        session,
        action="scan.create",
        actor_id=user.id,
        entity="scan",
        entity_id=scan.id,
        ip=request.client.host if request.client else None,
        detail={"module": module.value, "workflow": workflow.value},
    )
    return ScanPublic.model_validate(scan)


@router.post("/scans/{scan_id}/analyze", response_model=ScanWithResult)
async def analyze_scan(
    scan_id: uuid.UUID,
    session: SessionDep,
    user: CurrentUserDep,
) -> ScanWithResult:
    """Run the orchestrated inference pipeline for a scan.

    Phase 1 runs synchronously with stub agents. Later phases move heavy
    inference onto the queue (Arq) and stream progress via SSE — the API shape
    stays the same.
    """
    scan = await _load_scan(session, scan_id, user.id)
    if scan.status == ScanStatus.PROCESSING:
        raise ValidationAppError("Scan is already being processed.")

    scan.status = ScanStatus.PROCESSING
    await session.flush()

    orchestrator = get_orchestrator()
    result = await orchestrator.run(
        request_id=uuid.uuid4().hex,
        module=str(scan.module),
        workflow=str(scan.workflow),
        scan_id=str(scan.id),
        payload={"source_uri": scan.source_uri, "modality": scan.modality},
        context={"user_id": str(user.id), "org_id": str(user.organization_id or "")},
    )

    if result.status == "rejected":
        scan.status = ScanStatus.REJECTED
        await session.flush()
        return ScanWithResult.model_validate(scan)
    if result.status != "ok" or not result.summary:
        scan.status = ScanStatus.FAILED
        await session.flush()
        return ScanWithResult.model_validate(scan)

    s = result.summary
    latency = int(sum(step.trace.get("elapsed_ms", 0) for step in result.steps))
    prediction = Prediction(
        scan_id=scan.id,
        model_name=s.get("model_name") or "unknown",
        model_version=s.get("model_version") or "0.0.0",
        top_label=s["top_label"],
        top_confidence=Decimal(str(round(float(s.get("confidence") or 0), 4))),
        severity=s.get("severity"),
        classes=s.get("classes", []),
        explanation=s.get("explanation"),
        latency_ms=latency,
    )
    session.add(prediction)
    scan.status = ScanStatus.DONE
    await session.flush()

    if s.get("confidence") is not None:
        inference_confidence.labels(prediction.model_name).observe(float(s["confidence"]))

    await audit.record(
        session,
        action="scan.analyze",
        actor_id=user.id,
        entity="scan",
        entity_id=scan.id,
        detail={"pipeline": result.pipeline, "top_label": prediction.top_label},
    )

    out = ScanWithResult.model_validate(scan)
    out.prediction = PredictionPublic.model_validate(prediction)
    return out


@router.get("/scans/{scan_id}", response_model=ScanWithResult)
async def get_scan(
    scan_id: uuid.UUID,
    session: SessionDep,
    user: CurrentUserDep,
) -> ScanWithResult:
    scan = await _load_scan(session, scan_id, user.id)
    out = ScanWithResult.model_validate(scan)
    pred = await _latest_prediction(session, scan.id)
    if pred:
        out.prediction = PredictionPublic.model_validate(pred)
    return out


async def _latest_prediction(session: AsyncSession, scan_id: uuid.UUID) -> Prediction | None:
    result = await session.execute(
        select(Prediction)
        .where(Prediction.scan_id == scan_id)
        .order_by(Prediction.created_at.desc())
    )
    return result.scalars().first()


@router.post("/scans/{scan_id}/report", response_model=ReportPublic)
async def generate_report(
    scan_id: uuid.UUID,
    session: SessionDep,
    user: CurrentUserDep,
) -> ReportPublic:
    """Generate (or return existing) clinical narrative report for a scan."""
    scan = await _load_scan(session, scan_id, user.id)
    pred = await _latest_prediction(session, scan.id)
    if pred is None:
        raise ValidationAppError("Scan has no analysis to report on yet.")

    existing = await session.execute(select(Report).where(Report.prediction_id == pred.id))
    report = existing.scalars().first()
    if report is not None:
        return ReportPublic.model_validate(report)

    explanation = None
    context = {
        "module": str(scan.module),
        "modality": scan.modality,
        "finding": pred.top_label,
        "confidence": float(pred.top_confidence),
        "severity": pred.severity,
        "classes": pred.classes,
        "model": pred.model_name,
    }
    if isinstance(pred.explanation, dict):
        explanation = pred.explanation
        context["observations"] = explanation.get("observations", [])

    narrative = await generate_report_narrative(context)

    report = Report(
        scan_id=scan.id,
        prediction_id=pred.id,
        report_number=f"AMV-{scan.id.hex[:8].upper()}",
        narrative=narrative.model_dump(),
        llm_model=narrative.generated_by,
        llm_prompt_version="report-v1",
    )
    session.add(report)
    await session.flush()

    await audit.record(
        session,
        action="report.generate",
        actor_id=user.id,
        entity="report",
        entity_id=report.id,
        detail={"scan_id": str(scan.id)},
    )
    return ReportPublic.model_validate(report)


@router.get("/scans/{scan_id}/report", response_model=ReportPublic)
async def get_report(
    scan_id: uuid.UUID,
    session: SessionDep,
    user: CurrentUserDep,
) -> ReportPublic:
    scan = await _load_scan(session, scan_id, user.id)
    result = await session.execute(
        select(Report).where(Report.scan_id == scan.id).order_by(Report.created_at.desc())
    )
    report = result.scalars().first()
    if report is None:
        raise NotFoundError("No report generated for this scan yet.")
    return ReportPublic.model_validate(report)


@router.get("/scans", response_model=Page[ScanPublic])
async def list_scans(
    session: SessionDep,
    user: CurrentUserDep,
    module: Module | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Page[ScanPublic]:
    filters = [Scan.user_id == user.id]
    if module:
        filters.append(Scan.module == module)

    total = await session.scalar(select(func.count()).select_from(Scan).where(*filters)) or 0
    rows = await session.execute(
        select(Scan)
        .where(*filters)
        .order_by(Scan.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [ScanPublic.model_validate(s) for s in rows.scalars().all()]
    return Page(items=items, total=total, page=page, page_size=page_size)
