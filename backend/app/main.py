from __future__ import annotations

import asyncio
import io
from typing import Annotated

import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageOps, UnidentifiedImageError

from .config import MAX_IMAGE_BYTES, SUPPORTED_IMAGE_TYPES, cors_origins, frontend_dir
from .gemini import GeminiError, edit_image
from .prompts import (
    INTENSITY_DIRECTIONS,
    STYLE_DIRECTIONS,
    art_style_prompt,
    border_prompt,
    magic_edit_prompt,
    upscale_prompt,
)
from .routes_tools import router as tools_router
from .segmentation import model_loaded as sam_loaded
from .segmentation import segment_image
from .tools.ai_support import (
    PRINT_SIZES,
    build_edit_mask,
    build_subject_reference,
    fit_to_print,
    plan_upscale,
    print_dimensions,
)
from .upscaler import model_loaded as upscaler_loaded
from .upscaler import models_installed, upscale_image


app = FastAPI(title="Photo Finale API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    expose_headers=["X-Image-Width", "X-Image-Height", "X-Upscale-Model", "X-Processing-Time-Ms"],
)

app.include_router(tools_router)

_inference_lock = asyncio.Lock()


async def read_image(upload: UploadFile, *, force_png: bool = False) -> tuple[bytes, str]:
    mime_type = "image/png" if force_png else (upload.content_type or "")
    if mime_type not in SUPPORTED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Choose a PNG, JPEG, or WebP image")
    data = await upload.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image must be 20 MB or smaller")
    try:
        image = Image.open(io.BytesIO(data))
        image.verify()
    except (UnidentifiedImageError, OSError) as error:
        raise HTTPException(status_code=400, detail="Unsupported or invalid image") from error
    return data, mime_type


def image_response(data: bytes, mime_type: str, **headers: str) -> Response:
    return Response(content=data, media_type=mime_type, headers={"Cache-Control": "no-store", **headers})


def gemini_failure(error: Exception) -> HTTPException:
    return HTTPException(status_code=502, detail=str(error))


@app.get("/health")
async def health() -> dict[str, object]:
    cuda = torch.cuda.is_available()
    return {
        "ok": True,
        "cuda": cuda,
        "gpu": torch.cuda.get_device_name(0) if cuda else None,
        "samLoaded": sam_loaded(),
        "upscalerInstalled": models_installed(),
        "upscalerLoaded": upscaler_loaded(),
    }


@app.post("/segment")
async def segment(image: Annotated[UploadFile, File()], points: Annotated[str, Form()]) -> dict[str, object]:
    data, _ = await read_image(image)
    async with _inference_lock:
        try:
            return await asyncio.to_thread(segment_image, data, points)
        except HTTPException:
            raise
        except Exception as error:
            raise HTTPException(status_code=500, detail=f"SAM 3 inference failed: {error}") from error


def source_dimensions(data: bytes) -> tuple[int, int]:
    with Image.open(io.BytesIO(data)) as image:
        return image.size


@app.post("/upscale")
async def upscale(
    image: Annotated[UploadFile, File()],
    scale: Annotated[int, Form()] = 2,
    strength: Annotated[float, Form()] = 0.75,
) -> Response:
    if scale not in (2, 4):
        raise HTTPException(status_code=400, detail="Choose a 2x or 4x upscale")
    data, _ = await read_image(image)
    width, height = source_dimensions(data)
    plan = plan_upscale(width, height, scale, "faithful")
    async with _inference_lock:
        try:
            output, headers = await asyncio.to_thread(
                upscale_image, data, plan.width, plan.height, strength
            )
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        except RuntimeError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        except Exception as error:
            raise HTTPException(status_code=500, detail=f"Real-ESRGAN inference failed: {error}") from error
    return image_response(output, "image/png", **headers)


@app.post("/ai/upscale")
async def ai_upscale(
    image: Annotated[UploadFile, File()],
    scale: Annotated[int, Form()] = 2,
) -> Response:
    if scale not in (2, 4):
        raise HTTPException(status_code=400, detail="Choose a 2x or 4x upscale")
    data, mime_type = await read_image(image)
    width, height = source_dimensions(data)
    plan = plan_upscale(width, height, scale, "ai")
    if not 1 / 3 <= plan.width / plan.height <= 3:
        raise HTTPException(status_code=400, detail="This image is too elongated to upscale")
    try:
        result = await edit_image(
            upscale_prompt(scale), [(data, mime_type)], image_size="4K" if scale == 4 else "2K"
        )
    except GeminiError as error:
        raise gemini_failure(error) from error
    return image_response(
        result.data,
        result.mime_type,
        **{"X-Image-Width": str(plan.width), "X-Image-Height": str(plan.height)},
    )


@app.post("/art-style")
async def art_style(
    image: Annotated[UploadFile, File()],
    style: Annotated[str, Form()],
    intensity: Annotated[str, Form()],
) -> Response:
    data, mime_type = await read_image(image)
    if style not in STYLE_DIRECTIONS or intensity not in INTENSITY_DIRECTIONS:
        raise HTTPException(status_code=400, detail="Choose a supported style and intensity")
    try:
        result = await edit_image(art_style_prompt(style, intensity), [(data, mime_type)])
    except GeminiError as error:
        raise gemini_failure(error) from error
    return image_response(result.data, result.mime_type)


@app.post("/magic-edit")
async def magic_edit(
    image: Annotated[UploadFile, File()],
    mask: Annotated[UploadFile, File()],
    operation: Annotated[str, Form()],
    instruction: Annotated[str, Form()] = "",
) -> Response:
    """``mask`` is the translucent overlay from /segment; it is hardened here."""
    if operation not in ("remove", "replace", "retouch"):
        raise HTTPException(status_code=400, detail="Choose a supported edit operation")
    if len(instruction) > 1500:
        raise HTTPException(status_code=400, detail="Edit instructions must be 1,500 characters or fewer")
    if operation != "remove" and not instruction.strip():
        raise HTTPException(status_code=400, detail="Describe the requested edit")

    source_data, source_type = await read_image(image)
    mask_data, _ = await read_image(mask, force_png=True)
    source_image = Image.open(io.BytesIO(source_data))
    source_image.load()
    mask_image = Image.open(io.BytesIO(mask_data))
    mask_image.load()

    inputs = [
        (source_data, source_type),
        (build_edit_mask(mask_image, source_image.width, source_image.height), "image/png"),
    ]
    if operation == "retouch":
        try:
            inputs.append((build_subject_reference(source_image, mask_image), "image/png"))
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    try:
        result = await edit_image(magic_edit_prompt(operation, instruction.strip()), inputs)
    except GeminiError as error:
        raise gemini_failure(error) from error
    return image_response(result.data, result.mime_type)


@app.post("/border-expand")
async def border_expand(
    image: Annotated[UploadFile, File()],
    print_size: Annotated[str, Form()],
    orientation: Annotated[str, Form()],
) -> Response:
    if print_size not in PRINT_SIZES or orientation not in ("portrait", "landscape"):
        raise HTTPException(status_code=400, detail="Choose a supported print size and orientation")
    data, mime_type = await read_image(image)
    width, height = print_dimensions(print_size, orientation)
    aspect_ratio = "2:3" if orientation == "portrait" else "3:2"
    try:
        result = await edit_image(
            border_prompt(orientation, print_size, width, height),
            [(data, mime_type)],
            aspect_ratio=aspect_ratio,
            image_size="2K",
        )
    except GeminiError as error:
        raise gemini_failure(error) from error

    # The model honours the aspect ratio but not the exact pixel count.
    expanded = Image.open(io.BytesIO(result.data))
    expanded.load()
    fitted = fit_to_print(expanded, width, height)
    buffer = io.BytesIO()
    fitted.save(buffer, format="PNG")
    return image_response(
        buffer.getvalue(),
        "image/png",
        **{"X-Image-Width": str(width), "X-Image-Height": str(height)},
    )


# Registered last so API routes take precedence over static frontend files.
if frontend_dir().is_dir():
    app.mount("/", StaticFiles(directory=frontend_dir(), html=True), name="frontend")
