"""The Focus panel: selective blur driven by a gradient mask.

Each focus type produces a mask where white keeps the sharp image and black
falls back to a blurred copy, which is how the reference editor renders tilt
shift and vignette style effects.
"""

from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageFilter

from .edit_document import FocusSettings

#: What the Focus panel offers, in the order the tiles appear.
FOCUS_TYPES: tuple[dict[str, str], ...] = (
    {"id": "radial", "label": "Radial"},
    {"id": "mirrored", "label": "Mirrored"},
    {"id": "linear", "label": "Linear"},
    {"id": "gaussian", "label": "Gaussian"},
)


def default_focus(width: int, height: int, focus_type: str) -> FocusSettings:
    """Sensible starting geometry when a focus type is first selected."""
    spread = 0.42 if focus_type == "gaussian" else 0.3
    return FocusSettings(
        type=focus_type,  # type: ignore[arg-type]
        intensity=15,
        x=width / 2,
        y=height / 2,
        radius=max(1.0, min(width, height) * spread),
        angle=0,
    )


def _blur_radius(focus: FocusSettings, width: int, height: int) -> float:
    base = max(width, height) / 100.0
    scale = 1.6 if focus.type == "gaussian" else 1.0
    return max(1.0, base * (0.6 + (focus.intensity / 100.0) * 5.0) * scale)


def _gradient_mask(focus: FocusSettings, width: int, height: int) -> Image.Image:
    """An L-mode mask: 255 stays sharp, 0 is fully blurred."""
    ys, xs = np.mgrid[0:height, 0:width]
    xs = xs.astype(np.float32) - focus.x
    ys = ys.astype(np.float32) - focus.y

    radians = math.radians(focus.angle)
    normal_x = math.sin(radians)
    normal_y = -math.cos(radians)
    radius = max(1.0, focus.radius)

    if focus.type in ("radial", "gaussian"):
        inner = radius * (0.15 if focus.type == "gaussian" else 0.55)
        outer = max(inner + 1.0, radius)
        distance = np.sqrt(xs * xs + ys * ys)
        position = (distance - inner) / (outer - inner)
        midpoint = 0.55 if focus.type == "gaussian" else 0.75
        stops_at, stops_value = [0.0, midpoint, 1.0], [1.0, 0.75, 0.0]
    elif focus.type == "mirrored":
        # Distance along the band axis, normalised so the band edges land at 0 and 1.
        projection = (xs * normal_x + ys * normal_y) / radius
        position = (projection + 1.0) / 2.0
        stops_at, stops_value = [0.0, 0.3, 0.7, 1.0], [0.0, 1.0, 1.0, 0.0]
    else:
        projection = (xs * normal_x + ys * normal_y) / (radius * 1.6)
        position = projection
        stops_at, stops_value = [0.0, 1.0], [1.0, 0.0]

    alpha = np.interp(np.clip(position, 0.0, 1.0), stops_at, stops_value)
    return Image.fromarray((alpha * 255).astype(np.uint8), "L")


def apply_focus(image: Image.Image, focus: FocusSettings | None) -> Image.Image:
    """Blend a blurred copy of ``image`` in wherever the focus mask falls off."""
    if focus is None or focus.intensity <= 0:
        return image

    width, height = image.size
    blurred = image.filter(ImageFilter.GaussianBlur(_blur_radius(focus, width, height)))
    return Image.composite(image, blurred, _gradient_mask(focus, width, height))
