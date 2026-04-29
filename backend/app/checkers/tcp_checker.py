import asyncio
import socket
import time
from datetime import datetime, timezone

from app.schemas import CheckResultEvent


async def check_tcp(endpoint) -> CheckResultEvent:
    timeout = float(endpoint.timeout_s or 5)
    now = datetime.now(timezone.utc)
    start = time.monotonic()

    try:
        _, writer = await asyncio.wait_for(
            asyncio.open_connection(endpoint.hostname, endpoint.port),
            timeout=timeout,
        )
        elapsed_ms = int((time.monotonic() - start) * 1000)
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass

        if endpoint.degraded_ms and elapsed_ms > endpoint.degraded_ms:
            status = "degraded"
        else:
            status = "up"

        return CheckResultEvent(
            id_endpoint=endpoint.id_endpoint,
            checked_at=now,
            status=status,
            latency_ms=elapsed_ms,
            status_code=None,
            error_message=None,
        )

    except asyncio.TimeoutError:
        return CheckResultEvent(
            id_endpoint=endpoint.id_endpoint,
            checked_at=now,
            status="down",
            latency_ms=None,
            status_code=None,
            error_message=f"Timeout after {endpoint.timeout_s}s",
        )

    except OSError as exc:
        msg = str(exc).lower()
        if "connection refused" in msg or getattr(exc, "errno", None) == 111:
            error = f"Connection refused at {endpoint.hostname}:{endpoint.port}"
        elif (
            "name or service not known" in msg
            or "nodename nor servname" in msg
            or getattr(exc, "errno", None) in (socket.EAI_NONAME, -2)
        ):
            error = f"Host not found: {endpoint.hostname}"
        else:
            error = str(exc)
        return CheckResultEvent(
            id_endpoint=endpoint.id_endpoint,
            checked_at=now,
            status="down",
            latency_ms=None,
            status_code=None,
            error_message=error,
        )
