import time
from datetime import datetime, timezone

import httpx

from app.schemas import CheckResultEvent


def _build_url(endpoint) -> str:
    use_https = endpoint.protocol == "https" or endpoint.port == 443
    scheme = "https" if use_https else "http"
    return f"{scheme}://{endpoint.hostname}:{endpoint.port}"


async def check_http(endpoint) -> CheckResultEvent:
    url = _build_url(endpoint)
    timeout = float(endpoint.timeout_s or 5)
    now = datetime.now(timezone.utc)

    try:
        async with httpx.AsyncClient(timeout=timeout, verify=True, follow_redirects=True) as client:
            start = time.monotonic()
            response = await client.head(url)
            if response.status_code == 405:
                start = time.monotonic()
                response = await client.get(url)
            elapsed_ms = int((time.monotonic() - start) * 1000)

        if response.status_code >= 500:
            return CheckResultEvent(
                id_endpoint=endpoint.id_endpoint,
                checked_at=now,
                status="down",
                latency_ms=elapsed_ms,
                status_code=response.status_code,
                error_message=f"Server error: HTTP {response.status_code}",
            )

        if endpoint.degraded_ms and elapsed_ms > endpoint.degraded_ms:
            status = "degraded"
        else:
            status = "up"

        return CheckResultEvent(
            id_endpoint=endpoint.id_endpoint,
            checked_at=now,
            status=status,
            latency_ms=elapsed_ms,
            status_code=response.status_code,
            error_message=None,
        )

    except httpx.TimeoutException:
        return CheckResultEvent(
            id_endpoint=endpoint.id_endpoint,
            checked_at=now,
            status="down",
            latency_ms=None,
            status_code=None,
            error_message=f"Timeout after {endpoint.timeout_s}s",
        )

    except httpx.ConnectError as exc:
        msg = str(exc).lower()
        if "name or service not known" in msg or "nodename nor servname" in msg or "getaddrinfo" in msg:
            error = f"Host not found: {endpoint.hostname}"
        else:
            error = f"Connection refused at {endpoint.hostname}:{endpoint.port}"
        return CheckResultEvent(
            id_endpoint=endpoint.id_endpoint,
            checked_at=now,
            status="down",
            latency_ms=None,
            status_code=None,
            error_message=error,
        )

    except Exception as exc:
        return CheckResultEvent(
            id_endpoint=endpoint.id_endpoint,
            checked_at=now,
            status="down",
            latency_ms=None,
            status_code=None,
            error_message=str(exc),
        )
