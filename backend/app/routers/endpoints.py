from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import scheduler as sched
from app.database import get_session
from app.models import CheckResult, Endpoint
from app.schemas import CheckResultEvent, EndpointCreate, EndpointResponse

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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
# Routes
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
