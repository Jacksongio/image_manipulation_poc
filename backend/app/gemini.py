from __future__ import annotations

import asyncio
import base64
import os
import random
from dataclasses import dataclass
from typing import Any, Literal

import httpx


MODEL_ID = os.getenv("GEMINI_IMAGE_MODEL", "gemini-3.1-flash-image")
MAX_RETRY_DELAY_SECONDS = 4.0


class GeminiError(RuntimeError):
    pass


@dataclass(frozen=True)
class GeminiImage:
    data: bytes
    mime_type: str


def _retry_delay(response: httpx.Response | None, attempt: int) -> float:
    retry_after = response.headers.get("retry-after") if response is not None else None
    if retry_after:
        try:
            return min(max(float(retry_after), 0), MAX_RETRY_DELAY_SECONDS)
        except ValueError:
            pass
    return min(0.75 * (2**attempt) + random.random() * 0.25, MAX_RETRY_DELAY_SECONDS)


def _is_transient(status: int) -> bool:
    return status in (408, 429) or status >= 500


async def edit_image(
    prompt: str,
    images: list[tuple[bytes, str]],
    *,
    aspect_ratio: Literal["2:3", "3:2"] | None = None,
    image_size: Literal["1K", "2K", "4K"] | None = None,
) -> GeminiImage:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise GeminiError("GEMINI_API_KEY is not configured in the backend environment")

    image_parts = [
        {
            "inlineData": {
                "mimeType": mime_type,
                "data": base64.b64encode(data).decode("ascii"),
            }
        }
        for data, mime_type in images
    ]
    image_config: dict[str, str] = {}
    if aspect_ratio:
        image_config["aspectRatio"] = {
            "2:3": "ASPECT_RATIO_TWO_BY_THREE",
            "3:2": "ASPECT_RATIO_THREE_BY_TWO",
        }[aspect_ratio]
    if image_size:
        image_config["imageSize"] = {
            "1K": "IMAGE_SIZE_ONE_K",
            "2K": "IMAGE_SIZE_TWO_K",
            "4K": "IMAGE_SIZE_FOUR_K",
        }[image_size]

    generation_config: dict[str, Any] = {"responseModalities": ["IMAGE"]}
    if image_config:
        generation_config["responseFormat"] = {"image": image_config}
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}, *image_parts]}],
        "generationConfig": generation_config,
    }

    last_error = "Gemini is temporarily unavailable"
    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=20.0)) as client:
        for attempt in range(2):
            response: httpx.Response | None = None
            try:
                response = await client.post(
                    f"https://generativelanguage.googleapis.com/v1/models/{MODEL_ID}:generateContent",
                    headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
                    json=payload,
                )
            except httpx.HTTPError as error:
                last_error = str(error)
                if attempt == 0:
                    await asyncio.sleep(_retry_delay(None, attempt))
                    continue
                break

            try:
                value: dict[str, Any] = response.json()
            except ValueError:
                value = {}
            if not response.is_success:
                error_value = value.get("error")
                message = error_value.get("message") if isinstance(error_value, dict) else None
                last_error = message if isinstance(message, str) else f"Gemini failed with HTTP {response.status_code}"
                if response.status_code == 404 or "not supported" in last_error.lower():
                    raise GeminiError("The configured Gemini image model is unavailable for this API key")
                if not _is_transient(response.status_code):
                    raise GeminiError(last_error)
                if attempt == 0:
                    await asyncio.sleep(_retry_delay(response, attempt))
                    continue
                break

            candidates = value.get("candidates")
            parts: list[dict[str, Any]] = []
            if isinstance(candidates, list):
                for candidate in candidates:
                    content = candidate.get("content") if isinstance(candidate, dict) else None
                    candidate_parts = content.get("parts") if isinstance(content, dict) else None
                    if isinstance(candidate_parts, list):
                        parts.extend(part for part in candidate_parts if isinstance(part, dict))
            output_parts = [part for part in parts if isinstance(part.get("inlineData"), dict)]
            final = next((part for part in reversed(output_parts) if part.get("thought") is not True), None)
            if final is None and output_parts:
                final = output_parts[-1]
            if final is not None:
                inline = final["inlineData"]
                encoded = inline.get("data")
                if isinstance(encoded, str):
                    mime_type = inline.get("mimeType")
                    return GeminiImage(
                        base64.b64decode(encoded),
                        mime_type if isinstance(mime_type, str) else "image/png",
                    )
            raise GeminiError("Gemini returned no image")

    raise GeminiError(f"Gemini is temporarily busy after automatic retries: {last_error}")
