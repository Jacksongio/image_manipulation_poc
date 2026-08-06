"""HTTP surface for the sidebar tools.

The frontend posts the source image plus an edit document and reads back
pixels; every decision about what those values mean happens in :mod:`app.tools`.
"""

from __future__ import annotations

import asyncio
import base64
import io
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from PIL import Image
from pydantic import ValidationError

from .tools import build_catalog, compose, render_preview
from .tools.ai_support import upscale_plans
from .tools.edit_document import EditDocument
from .tools.renderer import DEFAULT_PREVIEW_EDGE
from .tools.thumbnails import filter_thumbnails, focus_thumbnails, text_design_thumbnails

router = APIRouter(prefix="/tools", tags=["tools"])

MAX_IMAGE_BYTES = 20 * 1024 * 1024


async def _read_image(upload: UploadFile) -> Image.Image:
    data = await upload.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image must be 20 MB or smaller")
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except Exception as error:
        raise HTTPException(status_code=400, detail="Unsupported or invalid image") from error
    return image.convert("RGBA") if image.mode in ("RGBA", "LA", "P") else image.convert("RGB")


def _parse_document(raw: str) -> EditDocument:
    try:
        return EditDocument.from_json(raw)
    except ValidationError as error:
        raise HTTPException(status_code=422, detail=f"Invalid edit document: {error}") from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail="Edit document must be valid JSON") from error


def _encode_png(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=False)
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def _data_url(image: Image.Image) -> str:
    return f"data:image/png;base64,{_encode_png(image)}"


@router.get("/catalog")
async def catalog() -> dict[str, object]:
    """Every control the sidebar renders, so the UI has no hard-coded presets."""
    return build_catalog()


@router.get("/text-design-previews")
async def text_design_previews(
    color: Annotated[str, Query(max_length=32)] = "#ffffff",
) -> dict[str, str]:
    """Sample tiles for the Text Design grid, keyed by template id."""
    tiles = await asyncio.to_thread(text_design_thumbnails, color)
    return {key: _data_url(value) for key, value in tiles.items()}


@router.get("/upscale-plan")
async def upscale_plan(
    width: Annotated[int, Query(gt=0, le=20000)],
    height: Annotated[int, Query(gt=0, le=20000)],
) -> dict[str, object]:
    """Output sizes for each Upscaler mode and scale, for the panel's readout."""
    return {"plans": upscale_plans(width, height)}


@router.post("/preview")
async def preview(
    image: Annotated[UploadFile, File()],
    document: Annotated[str, Form()],
    max_edge: Annotated[int, Form()] = DEFAULT_PREVIEW_EDGE,
) -> dict[str, object]:
    """The graded background plus one sprite per layer, for the canvas."""
    source = await _read_image(image)
    edit = _parse_document(document)
    render = await asyncio.to_thread(render_preview, source, edit, max_edge)

    return {
        "background": _data_url(render.background),
        "orientedWidth": render.oriented_width,
        "orientedHeight": render.oriented_height,
        "crop": {
            "x": render.crop.x,
            "y": render.crop.y,
            "width": render.crop.width,
            "height": render.crop.height,
        },
        "scale": render.scale,
        "layers": [
            {
                "id": layer.id,
                "image": _data_url(layer.image),
                "x": layer.x,
                "y": layer.y,
                "width": layer.width,
                "height": layer.height,
            }
            for layer in render.layers
        ],
    }


@router.post("/compose")
async def compose_document(
    image: Annotated[UploadFile, File()],
    document: Annotated[str, Form()],
) -> Response:
    """Flatten the document at full resolution, for Save and the AI tools."""
    source = await _read_image(image)
    edit = _parse_document(document)
    result = await asyncio.to_thread(compose, source, edit)

    buffer = io.BytesIO()
    result.save(buffer, format="PNG")
    return Response(
        content=buffer.getvalue(),
        media_type="image/png",
        headers={
            "Cache-Control": "no-store",
            "X-Image-Width": str(result.width),
            "X-Image-Height": str(result.height),
        },
    )


@router.post("/thumbnails")
async def thumbnails(
    image: Annotated[UploadFile, File()],
    kinds: Annotated[str, Form()] = "filters,focus",
) -> dict[str, dict[str, str]]:
    """Preview tiles for the Filters and Focus grids, keyed by option id."""
    source = await _read_image(image)
    requested = {kind.strip() for kind in kinds.split(",") if kind.strip()}
    unknown = requested - {"filters", "focus"}
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown thumbnail kind: {', '.join(sorted(unknown))}")

    result: dict[str, dict[str, str]] = {}
    if "filters" in requested:
        tiles = await asyncio.to_thread(filter_thumbnails, source)
        result["filters"] = {key: _data_url(value) for key, value in tiles.items()}
    if "focus" in requested:
        tiles = await asyncio.to_thread(focus_thumbnails, source)
        result["focus"] = {key: _data_url(value) for key, value in tiles.items()}
    return result
