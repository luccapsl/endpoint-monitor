import asyncio
import json
import time
from datetime import datetime, timezone

from app.schemas import CheckResultEvent

# Protocol ENUM value → (SQLAlchemy driver prefix, default port)
# This reuses the existing protocol ENUM to encode the database engine type,
# avoiding a schema change. The mapping is:
#   http  → PostgreSQL (postgresql+psycopg2)
#   https → MySQL      (mysql+pymysql)
#   tcp   → MariaDB    (mysql+pymysql — same driver as MySQL)
#   udp   → SQL Server (mssql+pyodbc)
_PROTOCOL_TO_DRIVER = {
    "http": ("postgresql+psycopg2", 5432),
    "https": ("mysql+pymysql", 3306),
    "tcp": ("mysql+pymysql", 3306),
    "udp": ("mssql+pyodbc", 1433),
}


def _parse_db_info(hostname: str) -> dict:
    """
    For database endpoints, hostname stores connection credentials as JSON:
    {"host": "db.example.com", "user": "admin", "password": "secret", "db": "mydb"}
    Falls back to treating hostname as bare host with empty credentials.
    """
    try:
        info = json.loads(hostname)
        if isinstance(info, dict) and "host" in info:
            return info
    except (json.JSONDecodeError, TypeError):
        pass
    return {"host": hostname, "user": "", "password": "", "db": ""}


def _do_check(
    hostname_raw: str,
    protocol: str,
    port: int,
    timeout_s: int,
    degraded_ms: int | None,
) -> tuple[str, int | None, str | None]:
    """Synchronous DB connectivity check — called in a thread executor."""
    from sqlalchemy import create_engine, text
    from sqlalchemy.engine.url import URL as SAUrl

    info = _parse_db_info(hostname_raw)
    host = info.get("host", "")
    user = info.get("user", "")
    password = info.get("password", "")
    db = info.get("db", "")

    driver, default_port = _PROTOCOL_TO_DRIVER.get(protocol or "https", ("mysql+pymysql", 3306))
    actual_port = port or default_port

    try:
        connect_args: dict = {}
        if "psycopg2" in driver:
            connect_args["connect_timeout"] = timeout_s
        elif "pymysql" in driver:
            connect_args["connect_timeout"] = timeout_s

        if "pyodbc" in driver:
            url = SAUrl.create(
                driver,
                username=user,
                password=password,
                host=host,
                port=actual_port,
                database=db,
                query={"driver": "ODBC Driver 17 for SQL Server"},
            )
        else:
            url = SAUrl.create(
                driver,
                username=user,
                password=password,
                host=host,
                port=actual_port,
                database=db,
            )

        engine = create_engine(url, connect_args=connect_args, pool_pre_ping=False)
        t0 = time.monotonic()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        elapsed = int((time.monotonic() - t0) * 1000)
        engine.dispose()

        if degraded_ms and elapsed > degraded_ms:
            return "degraded", elapsed, None
        return "up", elapsed, None

    except Exception as exc:
        msg = str(exc).lower()
        raw = str(exc)
        if any(k in msg for k in ("name or service not known", "could not translate host", "no such host", "nodename nor servname")):
            return "down", None, f"Host not found: {host}"
        if "connection refused" in msg or "could not connect to server" in msg:
            return "down", None, f"Connection refused: {host}:{actual_port}"
        if "timeout" in msg or "timed out" in msg:
            return "down", None, f"Timeout after {timeout_s}s"
        if any(k in msg for k in ("access denied", "authentication failed", "password", "login failed")):
            return "down", None, "Authentication failed: invalid user or password"
        if any(k in msg for k in ("unknown database", "database", "does not exist", "invalid catalog")):
            return "down", None, f"Database '{db}' not found"
        return "down", None, f"Connection error: {raw[:200]}"


async def check_database(endpoint) -> CheckResultEvent:
    timeout_s = endpoint.timeout_s or 5
    loop = asyncio.get_event_loop()
    try:
        status, latency_ms, error_message = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                _do_check,
                endpoint.hostname,
                endpoint.protocol,
                endpoint.port,
                timeout_s,
                endpoint.degraded_ms,
            ),
            timeout=timeout_s + 5,
        )
    except asyncio.TimeoutError:
        status, latency_ms, error_message = "down", None, f"Timeout after {timeout_s}s"

    return CheckResultEvent(
        id_endpoint=endpoint.id_endpoint,
        checked_at=datetime.now(timezone.utc),
        status=status,
        latency_ms=latency_ms,
        status_code=None,
        error_message=error_message,
    )
