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
        conn_str = build_connection_string(config.model_dump())
        engine = create_engine(conn_str, connect_args={"connect_timeout": 5})
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine.dispose()

        save_config(config.model_dump())
        init_engine(config.model_dump())
        init_db()
        return {"success": True}
    except Exception as exc:
        return {"success": False, "error": _classify_error(str(exc))}


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
