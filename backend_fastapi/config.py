"""Runtime settings, read from environment variables (see .env.example)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache


def _split(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str = "Airport Digital Twin API"
    version: str = "2.0.0"
    cors_origins: list[str] = field(default_factory=list)
    log_level: str = "INFO"
    max_jobs: int = 200
    job_workers: int = 2


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        cors_origins=_split(os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")),
        log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
        max_jobs=int(os.getenv("MAX_JOBS", "200")),
        job_workers=int(os.getenv("JOB_WORKERS", "2")),
    )
