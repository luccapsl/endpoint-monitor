from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.checkers.http_checker import check_http
from app.checkers.tcp_checker import check_tcp
from app.models import CheckResult, Endpoint
from app.routers.websocket import manager
from app.schemas import CheckResultEvent

scheduler = AsyncIOScheduler()

_JOB_PREFIX = "endpoint_"


def _job_id(endpoint_id: int) -> str:
    return f"{_JOB_PREFIX}{endpoint_id}"


def init_scheduler(app) -> None:  # noqa: ARG001 — app reserved for future state
    from app import database

    session = database._SessionLocal()
    try:
        active = session.query(Endpoint).filter(Endpoint.is_active.is_(True)).all()
        for ep in active:
            _schedule_job(ep)
    finally:
        session.close()

    scheduler.start()


def add_endpoint_job(endpoint) -> None:
    _schedule_job(endpoint)


def remove_endpoint_job(endpoint_id: int) -> None:
    job_id = _job_id(endpoint_id)
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)


def pause_endpoint_job(endpoint_id: int) -> None:
    job_id = _job_id(endpoint_id)
    if scheduler.get_job(job_id):
        scheduler.pause_job(job_id)


def resume_endpoint_job(endpoint_id: int) -> None:
    job_id = _job_id(endpoint_id)
    if scheduler.get_job(job_id):
        scheduler.resume_job(job_id)


def _schedule_job(endpoint) -> None:
    interval = max(endpoint.check_interval_s or 60, 1)
    scheduler.add_job(
        run_check,
        trigger=IntervalTrigger(seconds=interval),
        id=_job_id(endpoint.id_endpoint),
        args=[endpoint.id_endpoint],
        replace_existing=True,
        max_instances=1,
    )


async def run_check(endpoint_id: int) -> None:
    from app import database

    if database._SessionLocal is None:
        return

    session = database._SessionLocal()
    result: CheckResultEvent | None = None
    try:
        endpoint = session.get(Endpoint, endpoint_id)
        if endpoint is None or not endpoint.is_active:
            remove_endpoint_job(endpoint_id)
            return

        if endpoint.type == "http":
            result = await check_http(endpoint)
        elif endpoint.type == "tcp":
            result = await check_tcp(endpoint)
        else:
            return

        session.add(CheckResult(
            id_endpoint=endpoint_id,
            checked_at=result.checked_at,
            status=result.status,
            latency_ms=result.latency_ms,
            status_code=result.status_code,
            error_message=result.error_message,
        ))
        session.commit()
    except Exception:
        session.rollback()
    finally:
        session.close()

    if result is not None:
        await manager.broadcast(result.model_dump(mode="json"))
