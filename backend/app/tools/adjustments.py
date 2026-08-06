"""The twelve Adjust-panel sliders, expressed as a per-channel tone curve.

Everything that can be folded into a 256-entry lookup table lives here.
Saturation, monochrome, duotone, clarity and sharpness need whole-pixel or
neighbourhood context, so they are handled in :mod:`color_pipeline`.
"""

from __future__ import annotations

import numpy as np

from .edit_document import Adjustments
from .filter_presets import Rgb

#: How the Adjust panel groups and labels the sliders.
ADJUSTMENT_GROUPS: tuple[dict[str, object], ...] = (
    {
        "id": "basic",
        "label": "Basic",
        "sliders": (
            {"id": "brightness", "label": "Brightness"},
            {"id": "contrast", "label": "Contrast"},
            {"id": "saturation", "label": "Saturation"},
            {"id": "gamma", "label": "Gamma"},
            {"id": "clarity", "label": "Clarity"},
            {"id": "sharpness", "label": "Sharpness"},
        ),
    },
    {
        "id": "refinements",
        "label": "Refinements",
        "sliders": (
            {"id": "exposure", "label": "Exposure"},
            {"id": "shadows", "label": "Shadows"},
            {"id": "highlights", "label": "Highlights"},
            {"id": "blacks", "label": "Blacks"},
            {"id": "whites", "label": "Whites"},
            {"id": "temperature", "label": "Temperature"},
        ),
    },
)

#: Every slider shares one range, which keeps the panel UI uniform.
SLIDER_RANGE = {"min": -100, "max": 100, "step": 1, "neutral": 0}

_RAMP = np.arange(256, dtype=np.float64) / 255.0


def _contrast_factor(value: float) -> float:
    """The classic GIMP-style contrast curve, neutral at zero."""
    scaled = value * 2.55
    return (259.0 * (scaled + 255.0)) / (255.0 * (259.0 - scaled))


def build_tone_curve(
    adjustments: Adjustments,
    channel: int,
    gain: Rgb = (1.0, 1.0, 1.0),
    offset: Rgb = (0.0, 0.0, 0.0),
    fade: float = 0.0,
) -> np.ndarray:
    """A 256-entry uint8 curve for one channel, ordered the same way as the UI."""
    values = _RAMP.copy()

    exposure = 2.0 ** (adjustments.exposure / 50.0)
    brightness = adjustments.brightness / 200.0
    black_point = adjustments.blacks / 500.0
    white_point = 1.0 - adjustments.whites / 500.0
    span = max(0.05, white_point - black_point)
    shadows = adjustments.shadows / 200.0
    highlights = adjustments.highlights / 200.0
    contrast = _contrast_factor(adjustments.contrast)
    gamma = 2.0 ** (adjustments.gamma / 100.0)
    temperature = adjustments.temperature / 400.0
    warmth = temperature if channel == 0 else (-temperature if channel == 2 else 0.0)

    values *= exposure
    values += brightness
    values = (values - black_point) / span

    if shadows != 0:
        weight = (1.0 - np.clip(values, 0.0, 1.0)) ** 2
        values = values + shadows * weight
    if highlights != 0:
        weight = np.clip(values, 0.0, 1.0) ** 2
        values = values + highlights * weight

    values = (values - 0.5) * contrast + 0.5
    if gamma != 1:
        values = np.clip(values, 0.0, 1.0) ** (1.0 / gamma)

    values += warmth
    values = values * gain[channel] + offset[channel]
    if fade > 0:
        values = values * (1.0 - fade) + fade

    return np.clip(np.rint(values * 255.0), 0, 255).astype(np.uint8)


def merge_adjustments(base: Adjustments, overlay: dict[str, float], strength: float) -> Adjustments:
    """Layer a preset's adjustment offsets onto the user's own settings."""
    if not overlay or strength <= 0:
        return base
    merged = base.model_dump()
    for name, value in overlay.items():
        if name in merged:
            merged[name] = merged[name] + value * strength
    return Adjustments.model_construct(**merged)
