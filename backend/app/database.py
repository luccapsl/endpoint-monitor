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
    from sqlalchemy import inspect as sa_inspect

    inspector = sa_inspect(_engine)

    # SQLAlchemy 2.x MySQL dialect requires a non-None, non-empty schema for
    # has_table(). Using SELECT DATABASE() is more reliable than url.database,
    # which can return an empty string depending on URL parsing edge cases.
    if _engine.dialect.name == "mysql":
        with _engine.connect() as conn:
            schema = conn.execute(text("SELECT DATABASE()")).scalar()
        if not schema:
            raise ValueError(
                "No database selected — the connection string has no database name. "
                "Verify the 'Banco de Dados' field in the configuration."
            )
    else:
        schema = None

    for table in Base.metadata.sorted_tables:
        if not inspector.has_table(table.name, schema=schema):
            table.create(_engine)


def get_session() -> Generator:
    session = _SessionLocal()
    try:
        yield session
    finally:
        session.close()
