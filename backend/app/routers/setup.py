from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import create_engine, text

from app.config import config_exists, save_config
from app.database import build_connection_string, init_db, init_engine

router = APIRouter()


class ConnectionConfig(BaseModel):
    engine: str
    host: str
    port: int
    user: str
    password: str
    database: str


@router.get("/setup/status")
def get_status():
    return {"configured": config_exists()}


@router.post("/setup/test-connection")
def test_connection(config: ConnectionConfig):
    try:
        conn_str = build_connection_string(config.model_dump())
        engine = create_engine(conn_str, connect_args={"connect_timeout": 5})
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine.dispose()
        return {"success": True}
    except Exception as exc:
        return {"success": False, "error": _classify_error(str(exc))}


@router.post("/setup/save")
def save_setup(config: ConnectionConfig):
    try:
        data = config.model_dump()
        create_db = not data["database"].strip()
        data["database"] = data["database"].strip() or "endpoint_monitor"

        if create_db:
            _ensure_database(data)

        conn_str = build_connection_string(data)
        engine = create_engine(conn_str, connect_args={"connect_timeout": 5})
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine.dispose()

        init_engine(data)
        init_db()
        save_config(data)
        return {"success": True}
    except Exception as exc:
        return {"success": False, "error": _classify_error(str(exc))}


def _ensure_database(config: dict) -> None:
    db_name = config["database"]
    engine_type = config["engine"]

    if engine_type in ("mysql", "mariadb"):
        bootstrap = {**config, "database": ""}
        safe = db_name.replace("`", "``")
        stmt = text(f"CREATE DATABASE IF NOT EXISTS `{safe}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        engine = create_engine(build_connection_string(bootstrap), connect_args={"connect_timeout": 5})
        try:
            with engine.connect() as conn:
                conn.execute(stmt)
        finally:
            engine.dispose()

    elif engine_type == "postgresql":
        bootstrap = {**config, "database": "postgres"}
        safe = db_name.replace('"', '""')
        stmt = text(f'CREATE DATABASE "{safe}"')
        # CREATE DATABASE cannot run inside a transaction — requires AUTOCOMMIT
        engine = create_engine(
            build_connection_string(bootstrap),
            connect_args={"connect_timeout": 5},
            isolation_level="AUTOCOMMIT",
        )
        try:
            with engine.connect() as conn:
                exists = conn.execute(
                    text("SELECT 1 FROM pg_database WHERE datname = :name"),
                    {"name": db_name},
                ).fetchone()
                if not exists:
                    conn.execute(stmt)
        finally:
            engine.dispose()

    elif engine_type == "sqlserver":
        bootstrap = {**config, "database": "master"}
        safe = db_name.replace("]", "]]")
        stmt = text(f"IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'{db_name.replace(chr(39), chr(39)*2)}') CREATE DATABASE [{safe}]")
        engine = create_engine(build_connection_string(bootstrap), connect_args={"connect_timeout": 5})
        try:
            with engine.connect() as conn:
                conn.execute(stmt)
                conn.commit()
        finally:
            engine.dispose()


def _classify_error(error: str) -> str:
    e = error.lower()
    if "connection refused" in e or "can't connect" in e or "target machine actively refused" in e:
        return f"Conexão recusada — verifique se o banco está acessível nessa porta. Detalhe: {error}"
    if (
        "name or service not known" in e
        or "nodename nor servname" in e
        or "could not translate host" in e
        or "getaddrinfo failed" in e
        or "no such host" in e
    ):
        return f"Host não encontrado — verifique o hostname/IP. Detalhe: {error}"
    if (
        "access denied" in e
        or "authentication failed" in e
        or "password" in e
        or "login failed" in e
        or "invalid username" in e
    ):
        return f"Credenciais inválidas — verifique usuário e senha. Detalhe: {error}"
    if (
        "unknown database" in e
        or "database" in e
        and "does not exist" in e
        or "cannot open database" in e
    ):
        return f"Banco de dados não encontrado — verifique o nome do banco. Detalhe: {error}"
    return f"Erro de conexão: {error}"
