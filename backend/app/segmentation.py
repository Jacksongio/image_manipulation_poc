from __future__ import annotations

import base64
import hashlib
import io
import json
from dataclasses import dataclass
from typing import Any

import numpy as np
import torch
from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError

from .config import MAX_IMAGE_BYTES


@dataclass
class CachedImage:
    digest: str
    state: dict[str, Any]


_model: Any | None = None
_processor: Any | None = None
_cached_image: CachedImage | None = None


def model_loaded() -> bool:
    return _model is not None


def _load_model() -> tuple[Any, Any]:
    global _model, _processor
    if _model is None or _processor is None:
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA is unavailable; SAM 3 requires an NVIDIA GPU")
        try:
            from sam3.model.sam3_image_processor import Sam3Processor
            from sam3.model_builder import build_sam3_image_model
        except ImportError as error:
            raise RuntimeError("SAM 3 is not installed; run backend/scripts/setup.sh") from error
        _model = build_sam3_image_model(
            device="cuda",
            eval_mode=True,
            load_from_HF=True,
            enable_inst_interactivity=True,
        )
        _processor = Sam3Processor(_model, device="cuda")
    return _model, _processor


def _parse_points(raw: str, width: int, height: int) -> tuple[np.ndarray, np.ndarray]:
    try:
        points = json.loads(raw)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail="points must be valid JSON") from error
    if not isinstance(points, list) or not points or len(points) > 12:
        raise HTTPException(status_code=400, detail="Provide between 1 and 12 selection points")

    coordinates: list[list[float]] = []
    labels: list[int] = []
    for point in points:
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
    output = io.BytesIO()
    Image.fromarray(rgba, mode="RGBA").save(output, format="PNG", optimize=True)
    return base64.b64encode(output.getvalue()).decode("ascii")


def segment_image(image_bytes: bytes, raw_points: str) -> dict[str, object]:
    global _cached_image
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image must be 20 MB or smaller")
    try:
        source = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except (UnidentifiedImageError, OSError) as error:
        raise HTTPException(status_code=400, detail="Unsupported or invalid image") from error

    width, height = source.size
    if width < 32 or height < 32 or width * height > 16_000_000:
        raise HTTPException(status_code=400, detail="Image dimensions are unsupported")
    point_coords, point_labels = _parse_points(raw_points, width, height)
    digest = hashlib.sha256(image_bytes).hexdigest()

    model, processor = _load_model()
    if _cached_image is None or _cached_image.digest != digest:
        _cached_image = CachedImage(digest, processor.set_image(source))
    masks, scores, _ = model.predict_inst(
        _cached_image.state,
        point_coords=point_coords,
        point_labels=point_labels,
        multimask_output=True,
    )
    ranked = np.argsort(np.asarray(scores))[::-1]
    candidates = [
        {"mask": _mask_to_base64(np.asarray(masks[index], dtype=bool)), "score": float(scores[index])}
        for index in ranked[:3]
    ]
    return {"width": width, "height": height, "candidates": candidates}
