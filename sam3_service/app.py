from __future__ import annotations

import asyncio
import base64
import hashlib
import io
import json
from dataclasses import dataclass
from typing import Any

import numpy as np
import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError
from sam3.model.sam3_image_processor import Sam3Processor
from sam3.model_builder import build_sam3_image_model


MAX_IMAGE_BYTES = 20 * 1024 * 1024


@dataclass
class CachedImage:
    digest: str
    state: dict[str, Any]
    width: int
    height: int


app = FastAPI(title="Photo Finale SAM 3", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3009", "http://127.0.0.1:3009"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

_model: Any | None = None
_processor: Sam3Processor | None = None
_cached_image: CachedImage | None = None
_inference_lock = asyncio.Lock()


def _load_model() -> tuple[Any, Sam3Processor]:
    global _model, _processor
    if _model is None or _processor is None:
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA is unavailable; SAM 3 requires the local NVIDIA GPU")
        _model = build_sam3_image_model(
            device="cuda",
            eval_mode=True,
            load_from_HF=True,
            enable_inst_interactivity=True,
        )
        _processor = Sam3Processor(_model, device="cuda")
    return _model, _processor


def _parse_points(raw_points: str, width: int, height: int) -> tuple[np.ndarray, np.ndarray]:
    try:
        value = json.loads(raw_points)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail="points must be valid JSON") from error

    if not isinstance(value, list) or not value or len(value) > 12:
        raise HTTPException(status_code=400, detail="Provide between 1 and 12 selection points")

    coordinates: list[list[float]] = []
    labels: list[int] = []
    for point in value:
        if not isinstance(point, dict):
            raise HTTPException(status_code=400, detail="Each point must be an object")
        x, y, label = point.get("x"), point.get("y"), point.get("label")
        if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
            raise HTTPException(status_code=400, detail="Point coordinates must be numbers")
        if label not in (0, 1):
            raise HTTPException(status_code=400, detail="Point labels must be 0 or 1")
        if x < 0 or y < 0 or x >= width or y >= height:
            raise HTTPException(status_code=400, detail="A selection point is outside the image")
        coordinates.append([float(x), float(y)])
        labels.append(label)

    return np.asarray(coordinates, dtype=np.float32), np.asarray(labels, dtype=np.int32)


def _mask_to_base64(mask: np.ndarray) -> str:
    rgba = np.zeros((*mask.shape, 4), dtype=np.uint8)
    rgba[mask] = np.array([236, 77, 142, 150], dtype=np.uint8)
    image = Image.fromarray(rgba, mode="RGBA")
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=True)
    return base64.b64encode(output.getvalue()).decode("ascii")


@app.get("/health")
async def health() -> dict[str, object]:
    return {
        "ok": True,
        "cuda": torch.cuda.is_available(),
        "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "modelLoaded": _model is not None,
    }


@app.post("/segment")
async def segment(
    image: UploadFile = File(...),
    points: str = Form(...),
) -> dict[str, object]:
    global _cached_image

    image_bytes = await image.read(MAX_IMAGE_BYTES + 1)
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image must be 20 MB or smaller")

    try:
        source_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except (UnidentifiedImageError, OSError) as error:
        raise HTTPException(status_code=400, detail="Unsupported or invalid image") from error

    width, height = source_image.size
    if width < 32 or height < 32 or width * height > 16_000_000:
        raise HTTPException(status_code=400, detail="Image dimensions are unsupported")

    point_coords, point_labels = _parse_points(points, width, height)
    digest = hashlib.sha256(image_bytes).hexdigest()

    async with _inference_lock:
        try:
            model, processor = _load_model()
            if _cached_image is None or _cached_image.digest != digest:
                state = processor.set_image(source_image)
                _cached_image = CachedImage(digest, state, width, height)

            masks, scores, _ = model.predict_inst(
                _cached_image.state,
                point_coords=point_coords,
                point_labels=point_labels,
                multimask_output=True,
            )
        except HTTPException:
            raise
        except Exception as error:
            raise HTTPException(status_code=500, detail=f"SAM 3 inference failed: {error}") from error

    ranked = np.argsort(np.asarray(scores))[::-1]
    candidates = [
        {
            "mask": _mask_to_base64(np.asarray(masks[index], dtype=bool)),
            "score": float(scores[index]),
        }
        for index in ranked[:3]
    ]
    return {"width": width, "height": height, "candidates": candidates}
