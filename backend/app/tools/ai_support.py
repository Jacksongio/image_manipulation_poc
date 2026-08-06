"""Image preparation and sizing rules for the four AI panels.

These used to run on canvases in the browser. Keeping them here means the
frontend just posts the flattened image and reads back a result.
"""

from __future__ import annotations

import io
import math
from dataclasses import dataclass
from typing import Literal

import numpy as np
from PIL import Image

UpscaleMode = Literal["faithful", "ai"]

#: Alpha above which a SAM overlay pixel counts as selected.
_MASK_ALPHA_THRESHOLD = 20

#: ``previewFilter`` is a CSS filter the sidebar applies to a thumbnail as a
#: cheap hint at each style, since generating real previews would cost an API call.
ART_STYLES: tuple[dict[str, str], ...] = (
    {
        "id": "watercolor",
        "label": "Watercolor",
        "detail": "Soft washes & paper grain",
        "previewFilter": "saturate(0.75) contrast(0.8) brightness(1.1)",
    },
    {
        "id": "oil-painting",
        "label": "Oil Painting",
        "detail": "Rich colour & brushwork",
        "previewFilter": "saturate(1.5) contrast(1.25)",
    },
    {
        "id": "pencil-sketch",
        "label": "Pencil Sketch",
        "detail": "Graphite lines & shading",
        "previewFilter": "grayscale(1) contrast(1.25) brightness(1.1)",
    },
    {
        "id": "pop-art",
        "label": "Pop Art",
        "detail": "Bold ink & halftones",
        "previewFilter": "saturate(2) contrast(1.5)",
    },
    {
        "id": "anime",
        "label": "Anime",
        "detail": "Clean lines & cel shading",
        "previewFilter": "saturate(1.25) contrast(1.1) brightness(1.05)",
    },
    {
        "id": "impressionist",
        "label": "Impressionist",
        "detail": "Light-filled brushstrokes",
        "previewFilter": "saturate(1.25) contrast(0.8) brightness(1.1)",
    },
    {
        "id": "storybook",
        "label": "Storybook",
        "detail": "Warm painted whimsy",
        "previewFilter": "sepia(0.4) saturate(1.25) brightness(1.05)",
    },
    {
        "id": "vintage-poster",
        "label": "Vintage Poster",
        "detail": "Retro colour & texture",
        "previewFilter": "sepia(0.5) contrast(1.25) saturate(0.8)",
    },
)

STYLE_INTENSITIES: tuple[dict[str, str], ...] = (
    {"id": "subtle", "label": "Subtle"},
    {"id": "balanced", "label": "Balanced"},
    {"id": "bold", "label": "Bold"},
)

MAGIC_EDIT_OPERATIONS: tuple[dict[str, str], ...] = (
    {"id": "remove", "label": "Remove", "detail": "Erase the selection and fill it in"},
    {"id": "replace", "label": "Replace", "detail": "Swap the selection for something else"},
    {"id": "retouch", "label": "Retouch", "detail": "Restyle the selection, keeping identity"},
)

PRINT_SIZES: dict[str, dict[str, object]] = {
    "4x6": {
        "label": "4 × 6",
        "detail": "Classic photo print",
        "portrait": (1200, 1800),
        "landscape": (1800, 1200),
    },
    "5x7": {
        "label": "5 × 7",
        "detail": "Larger display print",
        "portrait": (1500, 2100),
        "landscape": (2100, 1500),
    },
}


def print_dimensions(print_size: str, orientation: str) -> tuple[int, int]:
    """Pixel dimensions for a print size at the chosen orientation."""
    entry = PRINT_SIZES[print_size]
    return entry[orientation]  # type: ignore[return-value]


# --- Magic Edit --------------------------------------------------------------


def _mask_alpha(mask: Image.Image, width: int, height: int) -> np.ndarray:
    """Boolean selection map from a SAM overlay, resized to the source."""
    resized = mask.convert("RGBA").resize((width, height), Image.Resampling.NEAREST)
    return np.asarray(resized)[..., 3] > _MASK_ALPHA_THRESHOLD


def build_edit_mask(mask: Image.Image, width: int, height: int) -> bytes:
    """SAM returns a translucent overlay; Gemini expects hard white on black."""
    selected = _mask_alpha(mask, width, height)
    pixels = np.where(selected[..., None], 255, 0).astype(np.uint8)
    hard = Image.fromarray(np.repeat(pixels, 3, axis=2), "RGB")
    buffer = io.BytesIO()
    hard.save(buffer, format="PNG")
    return buffer.getvalue()


def build_subject_reference(source: Image.Image, mask: Image.Image) -> bytes:
    """Crop the masked subject onto transparency so retouch keeps its identity."""
    width, height = source.size
    selected = _mask_alpha(mask, width, height)
    rows = np.any(selected, axis=1)
    columns = np.any(selected, axis=0)
    if not rows.any() or not columns.any():
        raise ValueError("The selected subject could not be prepared")

    top, bottom = int(np.argmax(rows)), int(len(rows) - np.argmax(rows[::-1]) - 1)
    left, right = int(np.argmax(columns)), int(len(columns) - np.argmax(columns[::-1]) - 1)

    padding = max(12, round(max(right - left + 1, bottom - top + 1) * 0.12))
    crop_left = max(0, left - padding)
    crop_top = max(0, top - padding)
    crop_right = min(width, right + padding + 1)
    crop_bottom = min(height, bottom + padding + 1)

    box = (crop_left, crop_top, crop_right, crop_bottom)
    subject = source.convert("RGBA").crop(box)
    alpha = Image.fromarray((selected * 255).astype(np.uint8), "L").crop(box)
    subject.putalpha(alpha)

    scale = min(1.0, 1024 / max(subject.width, subject.height))
    if scale < 1.0:
        subject = subject.resize(
            (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
            Image.Resampling.LANCZOS,
        )

    buffer = io.BytesIO()
    subject.save(buffer, format="PNG")
    return buffer.getvalue()


# --- Upscaler ----------------------------------------------------------------


@dataclass(frozen=True)
class UpscalePlan:
    """The output size a request will actually produce, after clamping."""

    width: int
    height: int
    #: Effective magnification once limits are applied, which can be below `scale`.
    actual_scale: float


def plan_upscale(width: int, height: int, scale: int, mode: UpscaleMode) -> UpscalePlan:
    """Clamp a requested magnification to what the chosen engine accepts."""
    edge_limit = 3840 if mode == "ai" else 8192
    pixel_limit = 3840 * 2160 if mode == "ai" else 40_000_000

    output_width = float(width * scale)
    output_height = float(height * scale)

    edge_scale = min(1.0, edge_limit / max(output_width, output_height))
    output_width *= edge_scale
    output_height *= edge_scale

    area_scale = min(1.0, math.sqrt(pixel_limit / (output_width * output_height)))
    output_width *= area_scale
    output_height *= area_scale

    def snap(value: float) -> int:
        # The AI engine only accepts multiples of 16.
        return max(256, round(value / 16) * 16) if mode == "ai" else max(256, round(value))

    final_width = snap(output_width)
    final_height = snap(output_height)
    return UpscalePlan(
        width=final_width,
        height=final_height,
        actual_scale=min(final_width / width, final_height / height),
    )


def upscale_plans(width: int, height: int) -> list[dict[str, object]]:
    """Every mode and scale combination the Upscaler panel can offer."""
    plans: list[dict[str, object]] = []
    for mode in ("faithful", "ai"):
        for scale in (2, 4):
            plan = plan_upscale(width, height, scale, mode)  # type: ignore[arg-type]
            plans.append(
                {
                    "mode": mode,
                    "scale": scale,
                    "width": plan.width,
                    "height": plan.height,
                    "actualScale": round(plan.actual_scale, 3),
                }
            )
    return plans


# --- Border Expander ---------------------------------------------------------


def fit_to_print(image: Image.Image, width: int, height: int) -> Image.Image:
    """Cover-fit the model output to exact print dimensions, centred."""
    if image.size == (width, height):
        return image.convert("RGB")
    scale = max(width / image.width, height / image.height)
    scaled = image.convert("RGB").resize(
        (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
        Image.Resampling.LANCZOS,
    )
    left = (scaled.width - width) // 2
    top = (scaled.height - height) // 2
    return scaled.crop((left, top, left + width, top + height))
