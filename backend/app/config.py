from __future__ import annotations

import os


MAX_IMAGE_BYTES = 20 * 1024 * 1024
SUPPORTED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp"}


def cors_origins() -> list[str]:
    raw = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3009,http://127.0.0.1:3009",
    )
    return [origin.strip() for origin in raw.split(",") if origin.strip()]
