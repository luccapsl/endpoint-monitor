from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    DateTime,
    TIMESTAMP,
)
from sqlalchemy.orm import relationship

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "user"

    id_user = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True)
    password = Column(String(255), nullable=False)
    role = Column(
        SAEnum("admin", "editor", "readonly", name="user_role"),
        nullable=False,
        default="readonly",
    )
    is_active = Column(Boolean, nullable=False, default=True)


class Endpoint(Base):
    __tablename__ = "endpoint"

    id_endpoint = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True)
    hostname = Column(String(255), nullable=False)
    type = Column(
        SAEnum("http", "tcp", "database", "dns", name="endpoint_type"),
        nullable=False,
    )
    is_active = Column(Boolean, nullable=False, default=True)
    port = Column(Integer, nullable=False)
    protocol = Column(
        SAEnum("tcp", "udp", "http", "https", "icmp", name="endpoint_protocol"),
        nullable=True,
    )
    check_interval_s = Column(Integer, nullable=True, default=60)
    timeout_s = Column(Integer, nullable=True, default=5)
    degraded_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    check_results = relationship(
        "CheckResult", back_populates="endpoint", cascade="all, delete-orphan"
    )


class CheckResult(Base):
    __tablename__ = "check_result"

    id_check_result = Column(Integer, primary_key=True, autoincrement=True)
    id_endpoint = Column(
        Integer,
        ForeignKey("endpoint.id_endpoint", ondelete="CASCADE"),
        nullable=False,
    )
    checked_at = Column(TIMESTAMP(timezone=True), nullable=False)
    status = Column(
        SAEnum("up", "down", "degraded", name="check_status"),
        nullable=False,
    )
    latency_ms = Column(Integer, nullable=True)
    status_code = Column(SmallInteger, nullable=True)
    error_message = Column(Text, nullable=True)

    endpoint = relationship("Endpoint", back_populates="check_results")
