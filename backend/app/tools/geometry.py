"""The Transform panel: aspect presets, flips, rotation, and cropping.

Orientation is baked into an axis-aligned image before anything else runs, so
every later stage (grading, focus, layers, crop) works in one flat coordinate
space measured in oriented-image pixels.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from PIL import Image

from .edit_document import CropRect, EditDocument


@dataclass(frozen=True)
class AspectPreset:
    id: str
    label: str
    #: None means the crop box is free-form.
    ratio: float | None


ASPECT_PRESETS: tuple[AspectPreset, ...] = (
    AspectPreset("custom", "Custom", None),
    AspectPreset("square", "Square", 1.0),
    AspectPreset("6x4", "6 X 4", 6 / 4),
    AspectPreset("4x6", "4 X 6", 4 / 6),
    AspectPreset("6x4.5", "6 X 4.5", 6 / 4.5),
    AspectPreset("4.5x6", "4.5 X 6", 4.5 / 6),
    AspectPreset("7x5", "7 X 5", 7 / 5),
    AspectPreset("5x7", "5 X 7", 5 / 7),
    AspectPreset("10x8", "10 X 8", 10 / 8),
    AspectPreset("8x10", "8 X 10", 8 / 10),
    AspectPreset("12x8", "12 X 8", 12 / 8),
    AspectPreset("8x12", "8 X 12", 8 / 12),
    AspectPreset("14x11", "14 X 11", 14 / 11),
    AspectPreset("11x14", "11 X 14", 11 / 14),
)

_PRESETS_BY_ID = {preset.id: preset for preset in ASPECT_PRESETS}


def fit_ratio(frame_width: float, frame_height: float, ratio: float) -> CropRect:
    """The largest rect of the given ratio that fits the frame, centred."""
    width = frame_width
    height = width / ratio
    if height > frame_height:
        height = frame_height
        width = height * ratio
    return CropRect(
        x=round((frame_width - width) / 2),
        y=round((frame_height - height) / 2),
        width=max(1, round(width)),
        height=max(1, round(height)),
    )


def crop_for_preset(preset_id: str, frame_width: float, frame_height: float) -> CropRect | None:
    """The crop a preset tile should produce; None restores the free-form box."""
    preset = _PRESETS_BY_ID.get(preset_id)
    if preset is None or preset.ratio is None:
        return None
    return fit_ratio(frame_width, frame_height, preset.ratio)


def oriented_size(source_width: int, source_height: int, document: EditDocument) -> tuple[int, int]:
    """The bounding size of the image once flips and rotation are applied."""
    swapped = document.quarter_turns % 2 == 1
    turned_width = source_height if swapped else source_width
    turned_height = source_width if swapped else source_height

    radians = math.radians(document.rotation)
    cos = abs(math.cos(radians))
    sin = abs(math.sin(radians))
    width = round(turned_width * cos + turned_height * sin)
    height = round(turned_width * sin + turned_height * cos)
    return max(1, width), max(1, height)


def orient_image(image: Image.Image, document: EditDocument) -> Image.Image:
    """Bake flips, quarter turns, and the fine rotation into the pixels."""
    result = image
    if document.flip_x:
        result = result.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    if document.flip_y:
        result = result.transpose(Image.Transpose.FLIP_TOP_BOTTOM)

    # Pillow rotates counter-clockwise; the canvas API the UI mirrors turns clockwise.
    quarter_turns = document.quarter_turns % 4
    if quarter_turns:
        result = result.rotate(-90 * quarter_turns, expand=True)

    if document.rotation:
        if result.mode != "RGBA":
            result = result.convert("RGBA")
        result = result.rotate(
            -document.rotation, resample=Image.Resampling.BICUBIC, expand=True
        )
    return result


def visible_rect(document: EditDocument, frame_width: int, frame_height: int) -> CropRect:
    """The crop clamped to the frame, or the whole frame when uncropped."""
    if document.crop is None:
        return CropRect(x=0, y=0, width=frame_width, height=frame_height)

    x = max(0.0, min(document.crop.x, frame_width - 1))
    y = max(0.0, min(document.crop.y, frame_height - 1))
    width = max(1.0, min(document.crop.width, frame_width - x))
    height = max(1.0, min(document.crop.height, frame_height - y))
    return CropRect(x=x, y=y, width=width, height=height)


def apply_crop(image: Image.Image, rect: CropRect) -> Image.Image:
    """Cut the visible rect out of an oriented frame."""
    left = int(round(rect.x))
    top = int(round(rect.y))
    right = min(image.width, left + int(round(rect.width)))
    bottom = min(image.height, top + int(round(rect.height)))
    if (left, top, right, bottom) == (0, 0, image.width, image.height):
        return image
    return image.crop((left, top, max(left + 1, right), max(top + 1, bottom)))


def output_size(document: EditDocument, rect: CropRect, source_width: int, source_height: int) -> tuple[int, int]:
    """Final pixel size, honouring the panel's Keep Resolution toggle."""
    width = max(1, int(round(rect.width)))
    height = max(1, int(round(rect.height)))
    if not document.keep_resolution:
        return width, height
    # Keep Resolution scales the crop back up to the original pixel count.
    target = math.sqrt(source_width * source_height)
    current = math.sqrt(width * height)
    if current <= 0:
        return width, height
    scale = target / current
    return max(1, round(width * scale)), max(1, round(height * scale))
