from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


class EndpointCreate(BaseModel):
    name: str
    hostname: str
    type: Literal["http", "tcp"]
    port: int
    protocol: Optional[Literal["tcp", "udp", "http", "https", "icmp"]] = None
    check_interval_s: Optional[int] = 60
    timeout_s: Optional[int] = 5
    degraded_ms: Optional[int] = None
    is_active: bool = True


class EndpointUpdate(BaseModel):
    name: Optional[str] = None
    hostname: Optional[str] = None
    type: Optional[Literal["http", "tcp"]] = None
    port: Optional[int] = None
    protocol: Optional[Literal["tcp", "udp", "http", "https", "icmp"]] = None
    check_interval_s: Optional[int] = None
    timeout_s: Optional[int] = None
    degraded_ms: Optional[int] = None
    is_active: Optional[bool] = None


class EndpointResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_endpoint: int
    name: str
    hostname: str
    type: str
    port: int
    protocol: Optional[str]
    check_interval_s: int
    timeout_s: int
    degraded_ms: Optional[int]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    last_status: Optional[str] = None
    last_latency_ms: Optional[int] = None
    last_checked_at: Optional[datetime] = None


class CheckResultEvent(BaseModel):
    id_endpoint: int
    checked_at: datetime
    status: str
    latency_ms: Optional[int] = None
    status_code: Optional[int] = None
    error_message: Optional[str] = None
