from typing import Generator
from urllib.parse import quote_plus

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

_engine = None
_SessionLocal = None


class Base(DeclarativeBase):
    pass


def build_connection_string(config: dict) -> str:
    engine = config["engine"]
    host = config["host"]
    port = config["port"]
    user = quote_plus(str(config["user"]))
    password = quote_plus(str(config["password"]))
    database = config["database"]

    if engine == "postgresql":
        return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{database}"
    elif engine in ("mysql", "mariadb"):
        return f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}"
    elif engine == "sqlserver":
        return (
            f"mssql+pyodbc://{user}:{password}@{host}:{port}/{database}"
            "?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes"
        )
    else:
        raise ValueError(f"Unsupported engine: {engine}")


def init_engine(config: dict) -> None:
    global _engine, _SessionLocal
    conn_str = build_connection_string(config)
    _engine = create_engine(conn_str, pool_pre_ping=True)
    _SessionLocal = sessionmaker(bind=_engine)


def init_db() -> None:
    import app.models  # noqa: F401 — registers all models with Base
    Base.metadata.create_all(_engine, checkfirst=True)


def get_session() -> Generator:
    session = _SessionLocal()
    try:
        yield session
    finally:
        session.close()
