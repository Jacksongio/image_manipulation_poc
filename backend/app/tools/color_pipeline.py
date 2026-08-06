"""Applies the Adjust and Filters panels to an image.

The two panels are evaluated together because a filter preset is just a bundle
of adjustment offsets plus a colour treatment; combining them into one pass
avoids quantising the image twice.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageFilter

from .adjustments import build_tone_curve, merge_adjustments
from .edit_document import Adjustments
from .filter_presets import DuotoneRamp, resolve_filter

#: Rec. 709 luminance weights, matching the browser's own filter maths.
_LUMA_WEIGHTS = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)


@dataclass(frozen=True)
class ColorPipeline:
    """A fully resolved colour treatment, ready to apply to any resolution."""

    #: Shape (3, 256) uint8 tone curves, one row per channel.
    tone_curves: np.ndarray
    saturation: float
    mono: float
    duotone: DuotoneRamp | None
    clarity: float
    sharpness: float

    @property
    def is_identity(self) -> bool:
        """True when applying this pipeline would leave the image untouched."""
        identity_ramp = np.arange(256, dtype=np.uint8)
        return (
            bool(np.array_equal(self.tone_curves, np.tile(identity_ramp, (3, 1))))
            and self.saturation == 0
            and self.mono == 0
            and self.duotone is None
            and self.clarity == 0
            and self.sharpness == 0
        )


def build_pipeline(
    adjustments: Adjustments,
    filter_identifier: str | None = None,
    filter_intensity: float = 0,
) -> ColorPipeline:
    """Resolve sliders plus an optional preset into a single colour treatment."""
    resolved = resolve_filter(filter_identifier)
    strength = min(1.0, max(0.0, filter_intensity / 100.0)) if resolved else 0.0
    grade = resolved.variant.grade if resolved else None

    merged = merge_adjustments(adjustments, grade.adjustments if grade else {}, strength)

    gain = (1.0, 1.0, 1.0)
    offset = (0.0, 0.0, 0.0)
    fade = 0.0
    mono = 0.0
    duotone: DuotoneRamp | None = None
    if grade is not None:
        gain = tuple(1 + (value - 1) * strength for value in grade.gain)  # type: ignore[assignment]
        offset = tuple(value * strength for value in grade.offset)  # type: ignore[assignment]
        fade = grade.fade * strength
        mono = grade.mono * strength
        if grade.duotone is not None:
            duotone = DuotoneRamp(
                grade.duotone.shadow, grade.duotone.highlight, grade.duotone.mix * strength
            )

    tone_curves = np.stack(
        [build_tone_curve(merged, channel, gain, offset, fade) for channel in range(3)]
    )

    return ColorPipeline(
        tone_curves=tone_curves,
        saturation=merged.saturation,
        mono=mono,
        duotone=duotone,
        clarity=merged.clarity,
        sharpness=merged.sharpness,
    )


def _unsharp(pixels: np.ndarray, radius: int, amount: float) -> np.ndarray:
    """Sharpen (or, with a negative amount, soften) via a box-blur low pass."""
    blurred = np.asarray(
        Image.fromarray(np.clip(pixels, 0, 255).astype(np.uint8), "RGB").filter(
            ImageFilter.BoxBlur(radius)
        ),
        dtype=np.float32,
    )
    return pixels + (pixels - blurred) * amount


def apply_pipeline(image: Image.Image, pipeline: ColorPipeline) -> Image.Image:
    """Return a graded copy of ``image``; the alpha channel is preserved."""
    if pipeline.is_identity:
        return image

    alpha = image.getchannel("A") if image.mode == "RGBA" else None
    rgb = image.convert("RGB")
    pixels = np.asarray(rgb, dtype=np.uint8)

    # The tone curves are the bulk of the work and reduce to three table lookups.
    curved = np.empty_like(pixels)
    for channel in range(3):
        curved[..., channel] = pipeline.tone_curves[channel][pixels[..., channel]]
    working = curved.astype(np.float32)

    saturation = 1.0 + pipeline.saturation / 100.0
    if saturation != 1.0 or pipeline.mono > 0 or pipeline.duotone is not None:
        luma = working @ _LUMA_WEIGHTS
        luma = luma[..., None]
        if saturation != 1.0:
            working = luma + (working - luma) * saturation
        if pipeline.mono > 0:
            working = working + (luma - working) * pipeline.mono
        if pipeline.duotone is not None:
            ramp = pipeline.duotone
            position = luma / 255.0
            shadow = np.array(ramp.shadow, dtype=np.float32)
            highlight = np.array(ramp.highlight, dtype=np.float32)
            target = shadow + (highlight - shadow) * position
            working = working + (target - working) * ramp.mix

    if pipeline.clarity != 0:
        height, width = working.shape[:2]
        radius = max(2, round(min(width, height) / 180))
        working = _unsharp(working, radius, pipeline.clarity / 130.0)
    if pipeline.sharpness != 0:
        working = _unsharp(working, 1, pipeline.sharpness / 70.0)

    result = Image.fromarray(np.clip(working, 0, 255).astype(np.uint8), "RGB")
    if alpha is not None:
        result = result.convert("RGBA")
        result.putalpha(alpha)
    return result
