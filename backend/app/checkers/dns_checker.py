import asyncio
import socket
import time
from datetime import datetime, timezone

from app.schemas import CheckResultEvent


async def check_dns(endpoint) -> CheckResultEvent:
    hostname = endpoint.hostname
    timeout_s = endpoint.timeout_s or 5

    def _resolve():
        return socket.getaddrinfo(hostname, None)

    t0 = time.monotonic()
    try:
        loop = asyncio.get_event_loop()
        await asyncio.wait_for(
            loop.run_in_executor(None, _resolve),
            timeout=timeout_s,
        )
        elapsed = int((time.monotonic() - t0) * 1000)

        if endpoint.degraded_ms and elapsed > endpoint.degraded_ms:
            status = "degraded"
        else:
            status = "up"

        return CheckResultEvent(
            id_endpoint=endpoint.id_endpoint,
            checked_at=datetime.now(timezone.utc),
            status=status,
            latency_ms=elapsed,
            status_code=None,
            error_message=None,
        )
    except asyncio.TimeoutError:
        return CheckResultEvent(
            id_endpoint=endpoint.id_endpoint,
            checked_at=datetime.now(timezone.utc),
            status="down",
            latency_ms=None,
            status_code=None,
            error_message=f"DNS resolution timeout after {timeout_s}s",
        )
    except socket.gaierror:
        return CheckResultEvent(
            id_endpoint=endpoint.id_endpoint,
            checked_at=datetime.now(timezone.utc),
            status="down",
            latency_ms=None,
            status_code=None,
            error_message=f"Host not found: {hostname}",
        )
    except Exception as exc:
        return CheckResultEvent(
            id_endpoint=endpoint.id_endpoint,
            checked_at=datetime.now(timezone.utc),
            status="down",
            latency_ms=None,
            status_code=None,
            error_message=str(exc)[:200],
        )
