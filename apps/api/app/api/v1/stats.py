"""Dashboard statistics — real aggregation over the user's scans/predictions."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import func, select

from app.api.deps import CurrentUserDep, SessionDep
from app.models.enums import ScanStatus, Severity
from app.models.scan import Prediction, Report, Scan

router = APIRouter(tags=["stats"])


class DashboardStats(BaseModel):
    total_scans: int
    analyzed: int
    flagged: int  # moderate/severe findings
    reports: int
    avg_confidence: float | None  # 0..1


@router.get("/stats/dashboard", response_model=DashboardStats)
async def dashboard_stats(session: SessionDep, user: CurrentUserDep) -> DashboardStats:
    total = await session.scalar(
        select(func.count()).select_from(Scan).where(Scan.user_id == user.id)
    )
    analyzed = await session.scalar(
        select(func.count())
        .select_from(Scan)
        .where(Scan.user_id == user.id, Scan.status == ScanStatus.DONE)
    )
    flagged = await session.scalar(
        select(func.count())
        .select_from(Prediction)
        .join(Scan, Scan.id == Prediction.scan_id)
        .where(
            Scan.user_id == user.id,
            Prediction.severity.in_([Severity.MODERATE, Severity.SEVERE]),
        )
    )
    reports = await session.scalar(
        select(func.count())
        .select_from(Report)
        .join(Scan, Scan.id == Report.scan_id)
        .where(Scan.user_id == user.id)
    )
    avg_conf = await session.scalar(
        select(func.avg(Prediction.top_confidence))
        .join(Scan, Scan.id == Prediction.scan_id)
        .where(Scan.user_id == user.id)
    )

    return DashboardStats(
        total_scans=total or 0,
        analyzed=analyzed or 0,
        flagged=flagged or 0,
        reports=reports or 0,
        avg_confidence=float(avg_conf) if avg_conf is not None else None,
    )
