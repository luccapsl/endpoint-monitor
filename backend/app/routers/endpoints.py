from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import scheduler as sched
from app.database import get_session
from app.models import CheckResult, Endpoint
from app.schemas import (
    CheckResultEvent,
    CheckResultItem,
    ChartPoint,
    EndpointCreate,
    EndpointMetrics,
    EndpointResponse,
)

router = APIRouter()

PERIOD_DELTA: dict[str, timedelta] = {
    "1min":  timedelta(minutes=1),
    "5min":  timedelta(minutes=5),
    "10min": timedelta(minutes=10),
    "30min": timedelta(minutes=30),
    "1h":    timedelta(hours=1),
    "6h":    timedelta(hours=6),
    "24h":   timedelta(hours=24),
    "7d":    timedelta(days=7),
    "30d":   timedelta(days=30),
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _aware(dt: datetime) -> datetime:
    """Ensure datetime is timezone-aware (assume UTC if naive)."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _latest_results_map(db: Session) -> dict[int, CheckResult]:
    """Return a dict of endpoint_id → latest CheckResult in a single query."""
    subq = (
        db.query(
            CheckResult.id_endpoint,
            func.max(CheckResult.checked_at).label("max_checked_at"),
        )
        .group_by(CheckResult.id_endpoint)
        .subquery()
    )
    rows = (
        db.query(CheckResult)
        .join(
            subq,
            (CheckResult.id_endpoint == subq.c.id_endpoint)
            & (CheckResult.checked_at == subq.c.max_checked_at),
        )
        .all()
    )
    return {r.id_endpoint: r for r in rows}


def _to_response(ep: Endpoint, last: CheckResult | None) -> EndpointResponse:
    return EndpointResponse(
        id_endpoint=ep.id_endpoint,
        name=ep.name,
        hostname=ep.hostname,
        type=ep.type,
        port=ep.port,
        protocol=ep.protocol,
        check_interval_s=ep.check_interval_s or 60,
        timeout_s=ep.timeout_s or 5,
        degraded_ms=ep.degraded_ms,
        is_active=ep.is_active,
        created_at=ep.created_at,
        updated_at=ep.updated_at,
        last_status=last.status if last else None,
        last_latency_ms=last.latency_ms if last else None,
        last_checked_at=last.checked_at if last else None,
    )


# ---------------------------------------------------------------------------
# CRUD Routes
# ---------------------------------------------------------------------------

@router.get("/endpoints", response_model=list[EndpointResponse])
def list_endpoints(db: Session = Depends(get_session)):
    endpoints = db.query(Endpoint).order_by(Endpoint.created_at).all()
    results_map = _latest_results_map(db)
    return [_to_response(ep, results_map.get(ep.id_endpoint)) for ep in endpoints]


@router.get("/endpoints/{endpoint_id}", response_model=EndpointResponse)
def get_endpoint(endpoint_id: int, db: Session = Depends(get_session)):
    ep = db.get(Endpoint, endpoint_id)
    if ep is None:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    last = (
        db.query(CheckResult)
        .filter(CheckResult.id_endpoint == endpoint_id)
        .order_by(CheckResult.checked_at.desc())
        .first()
    )
    return _to_response(ep, last)


@router.post("/endpoints", response_model=EndpointResponse, status_code=status.HTTP_201_CREATED)
async def create_endpoint(
    payload: EndpointCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_session),
):
    if not payload.name.strip():
        raise HTTPException(status_code=422, detail="name must not be blank")
    if not payload.hostname.strip():
        raise HTTPException(status_code=422, detail="hostname must not be blank")

    ep = Endpoint(**payload.model_dump())
    db.add(ep)
    db.commit()
    db.refresh(ep)

    sched.add_endpoint_job(ep)
    background_tasks.add_task(sched.run_check, ep.id_endpoint)

    return _to_response(ep, None)


@router.put("/endpoints/{endpoint_id}", response_model=EndpointResponse)
async def update_endpoint(
    endpoint_id: int, payload: EndpointCreate, db: Session = Depends(get_session)
):
    ep = db.get(Endpoint, endpoint_id)
    if ep is None:
        raise HTTPException(status_code=404, detail="Endpoint not found")

    for field, value in payload.model_dump().items():
        setattr(ep, field, value)
    db.commit()
    db.refresh(ep)

    sched.add_endpoint_job(ep)
    await sched.run_check(ep.id_endpoint)

    last = (
        db.query(CheckResult)
        .filter(CheckResult.id_endpoint == endpoint_id)
        .order_by(CheckResult.checked_at.desc())
        .first()
    )
    return _to_response(ep, last)


@router.delete("/endpoints/{endpoint_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_endpoint(endpoint_id: int, db: Session = Depends(get_session)):
    ep = db.get(Endpoint, endpoint_id)
    if ep is None:
        raise HTTPException(status_code=404, detail="Endpoint not found")

    sched.remove_endpoint_job(endpoint_id)
    db.delete(ep)
    db.commit()


@router.patch("/endpoints/{endpoint_id}/toggle", response_model=EndpointResponse)
def toggle_endpoint(endpoint_id: int, db: Session = Depends(get_session)):
    ep = db.get(Endpoint, endpoint_id)
    if ep is None:
        raise HTTPException(status_code=404, detail="Endpoint not found")

    ep.is_active = not ep.is_active
    db.commit()
    db.refresh(ep)

    if ep.is_active:
        sched.resume_endpoint_job(endpoint_id)
    else:
        sched.pause_endpoint_job(endpoint_id)

    last = (
        db.query(CheckResult)
        .filter(CheckResult.id_endpoint == endpoint_id)
        .order_by(CheckResult.checked_at.desc())
        .first()
    )
    return _to_response(ep, last)


# ---------------------------------------------------------------------------
# Metrics & History Routes (Phase 5)
# ---------------------------------------------------------------------------

@router.get("/endpoints/{endpoint_id}/history", response_model=list[CheckResultItem])
def get_endpoint_history(
    endpoint_id: int,
    limit: int = Query(default=50, le=200),
    since: Optional[datetime] = None,
    db: Session = Depends(get_session),
):
    ep = db.get(Endpoint, endpoint_id)
    if ep is None:
        raise HTTPException(status_code=404, detail="Endpoint not found")

    q = db.query(CheckResult).filter(CheckResult.id_endpoint == endpoint_id)
    if since:
        q = q.filter(CheckResult.checked_at >= _aware(since))
    return q.order_by(CheckResult.checked_at.desc()).limit(limit).all()


@router.get("/endpoints/{endpoint_id}/metrics", response_model=EndpointMetrics)
def get_endpoint_metrics(
    endpoint_id: int,
    period: str = Query(default="24h", pattern="^(1min|5min|10min|30min|1h|6h|24h|7d|30d)$"),
    db: Session = Depends(get_session),
):
    ep = db.get(Endpoint, endpoint_id)
    if ep is None:
        raise HTTPException(status_code=404, detail="Endpoint not found")

    delta = PERIOD_DELTA.get(period, timedelta(hours=24))
    since = datetime.now(timezone.utc) - delta

    results = (
        db.query(CheckResult)
        .filter(
            CheckResult.id_endpoint == endpoint_id,
            CheckResult.checked_at >= since,
        )
        .all()
    )

    total = len(results)
    if total == 0:
        return EndpointMetrics(
            period=period,
            uptime_percent=0.0,
            total_checks=0,
            checks_up=0,
            checks_down=0,
            checks_degraded=0,
        )

    checks_up = sum(1 for r in results if r.status == "up")
    checks_down = sum(1 for r in results if r.status == "down")
    checks_degraded = sum(1 for r in results if r.status == "degraded")
    # degraded counts as available for uptime calculation
    uptime_pct = (checks_up + checks_degraded) / total * 100

    latencies = sorted(r.latency_ms for r in results if r.latency_ms is not None)
    if latencies:
        n = len(latencies)
        avg_lat = round(sum(latencies) / n, 1)
        min_lat = latencies[0]
        max_lat = latencies[-1]
        p95_lat = latencies[min(int(n * 0.95), n - 1)]
        p99_lat = latencies[min(int(n * 0.99), n - 1)]
    else:
        avg_lat = min_lat = max_lat = p95_lat = p99_lat = None

    return EndpointMetrics(
        period=period,
        uptime_percent=round(uptime_pct, 2),
        total_checks=total,
        checks_up=checks_up,
        checks_down=checks_down,
        checks_degraded=checks_degraded,
        avg_latency_ms=avg_lat,
        p95_latency_ms=p95_lat,
        p99_latency_ms=p99_lat,
        min_latency_ms=min_lat,
        max_latency_ms=max_lat,
    )


@router.get("/endpoints/{endpoint_id}/chart", response_model=list[ChartPoint])
def get_endpoint_chart(
    endpoint_id: int,
    period: str = Query(default="1h", pattern="^(1min|5min|10min|30min|1h|6h|24h|7d|30d)$"),
    points: int = Query(default=60, le=300),
    db: Session = Depends(get_session),
):
    ep = db.get(Endpoint, endpoint_id)
    if ep is None:
        raise HTTPException(status_code=404, detail="Endpoint not found")

    delta = PERIOD_DELTA.get(period, timedelta(hours=1))
    now = datetime.now(timezone.utc)
    since = now - delta
    bucket_size_s = delta.total_seconds() / points

    results = (
        db.query(CheckResult)
        .filter(
            CheckResult.id_endpoint == endpoint_id,
            CheckResult.checked_at >= since,
        )
        .order_by(CheckResult.checked_at)
        .all()
    )

    if not results:
        return []

    buckets: dict[int, list[CheckResult]] = {}
    for r in results:
        checked_at = _aware(r.checked_at)
        offset_s = (checked_at - since).total_seconds()
        idx = max(0, min(int(offset_s / bucket_size_s), points - 1))
        buckets.setdefault(idx, []).append(r)

    chart_points: list[ChartPoint] = []
    for idx in sorted(buckets):
        bucket_rows = buckets[idx]
        bucket_time = since + timedelta(seconds=idx * bucket_size_s)
        lats = [r.latency_ms for r in bucket_rows if r.latency_ms is not None]
        avg_lat = round(sum(lats) / len(lats), 1) if lats else None
        # Use the most-recent result's status for the bucket
        bucket_status = bucket_rows[-1].status
        chart_points.append(ChartPoint(
            timestamp=bucket_time,
            avg_latency_ms=avg_lat,
            status=bucket_status,
        ))

    return chart_points
