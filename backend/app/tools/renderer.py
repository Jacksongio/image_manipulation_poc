"""Turns a source image plus an edit document into pixels.

Two entry points serve different needs:

``render_preview``
    The graded background and one sprite per layer, at a capped resolution.
    The frontend places the sprites itself so dragging stays instant.

``compose``
    A single flattened full-resolution image. Used for Save and as the input to
    every AI tool, so what ships is always what Python produced.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from PIL import Image

from .color_pipeline import apply_pipeline, build_pipeline
from .edit_document import BrushStrokeLayer, CropRect, EditDocument
from .focus_effects import apply_focus
from .geometry import apply_crop, orient_image, oriented_size, output_size, visible_rect
from .layer_painter import PaintedLayer, paint_layer

#: Longest edge of a preview render. Big enough to look right on screen,
#: small enough that a slider drag round-trips comfortably.
DEFAULT_PREVIEW_EDGE = 1400


@dataclass(frozen=True)
class PreviewRender:
    """The background plus the sprites the frontend should position.

    The background is *not* cropped: the Transform tool needs to show the whole
    oriented frame behind the crop overlay. ``crop`` is the resolved visible
    rect, which the frontend clips to for every other tool.
    """

    background: Image.Image
    layers: list[PaintedLayer]
    #: The document coordinate space, in oriented-image pixels.
    oriented_width: int
    oriented_height: int
    crop: CropRect
    #: background.width / oriented_width, so the frontend can scale the bitmap up.
    scale: float


def render_preview(
    image: Image.Image,
    document: EditDocument,
    max_edge: int = DEFAULT_PREVIEW_EDGE,
) -> PreviewRender:
    """Render at a capped resolution for on-screen editing."""
    oriented_width, oriented_height = oriented_size(image.width, image.height, document)
    rect = visible_rect(document, oriented_width, oriented_height)

    scale = 1.0
    if max_edge > 0:
        scale = min(1.0, max_edge / max(oriented_width, oriented_height))

    working = image
    if scale < 1.0:
        working = image.resize(
            (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
            Image.Resampling.LANCZOS,
        )

    # Focus geometry is in document pixels, so it has to follow the downscale.
    scaled_document = document.model_copy(
        update={
            "focus": None
            if document.focus is None
            else document.focus.model_copy(
                update={
                    "x": document.focus.x * scale,
                    "y": document.focus.y * scale,
                    "radius": max(1.0, document.focus.radius * scale),
                }
            ),
        }
    )

    oriented = orient_image(working, scaled_document)
    pipeline = build_pipeline(
        document.adjustments, document.filter.preset_id, document.filter.intensity
    )
    background = apply_focus(apply_pipeline(oriented, pipeline), scaled_document.focus)
    layers = [painted for layer in document.layers if (painted := paint_layer(layer)) is not None]

    return PreviewRender(
        background=background,
        layers=layers,
        oriented_width=oriented_width,
        oriented_height=oriented_height,
        crop=rect,
        scale=background.width / oriented_width if oriented_width else 1.0,
    )


def compose(image: Image.Image, document: EditDocument) -> Image.Image:
    """Flatten the whole document at full resolution."""
    oriented = orient_image(image, document)
    rect = visible_rect(document, oriented.width, oriented.height)

    pipeline = build_pipeline(
        document.adjustments, document.filter.preset_id, document.filter.intensity
    )
    graded = apply_pipeline(oriented, pipeline)
    focused = apply_focus(graded, document.focus)

    # Layers are positioned in oriented-image space, so paste before cropping.
    canvas = focused.convert("RGBA")
    for layer in document.layers:
        painted = paint_layer(layer)
        if painted is None:
            continue
        canvas.alpha_composite(*_place(layer, painted, canvas.size))

    cropped = apply_crop(canvas, rect)

    target = output_size(document, rect, image.width, image.height)
    if target != cropped.size:
        cropped = cropped.resize(target, Image.Resampling.LANCZOS)
    return cropped.convert("RGB")


def _place(layer, painted: PaintedLayer, canvas_size: tuple[int, int]):
    """Apply a layer's own scale and rotation, then clip it to the canvas."""
    sprite = painted.image
    x, y = painted.x, painted.y

    if not isinstance(layer, BrushStrokeLayer):
        scale_x = getattr(layer, "scale_x", 1.0) or 1.0
        scale_y = getattr(layer, "scale_y", 1.0) or 1.0
        if scale_x != 1.0 or scale_y != 1.0:
            sprite = sprite.resize(
                (max(1, round(sprite.width * scale_x)), max(1, round(sprite.height * scale_y))),
                Image.Resampling.LANCZOS,
            )
        rotation = getattr(layer, "rotation", 0.0)
        if rotation:
            # Rotating about the top-left keeps the anchor the frontend uses.
            before = sprite.size
            sprite = sprite.rotate(-rotation, resample=Image.Resampling.BICUBIC, expand=True)
            radians = math.radians(rotation)
            cos, sin = math.cos(radians), math.sin(radians)
            corners = [
                (0.0, 0.0),
                (before[0] * cos, before[0] * sin),
                (-before[1] * sin, before[1] * cos),
                (before[0] * cos - before[1] * sin, before[0] * sin + before[1] * cos),
            ]
            x += min(corner[0] for corner in corners)
            y += min(corner[1] for corner in corners)

    left, top = int(round(x)), int(round(y))
    canvas_width, canvas_height = canvas_size

    # alpha_composite cannot take negative or overflowing offsets, so crop first.
    crop_left = max(0, -left)
    crop_top = max(0, -top)
    crop_right = min(sprite.width, canvas_width - left)
    crop_bottom = min(sprite.height, canvas_height - top)
    if crop_right <= crop_left or crop_bottom <= crop_top:
        return Image.new("RGBA", (1, 1), (0, 0, 0, 0)), (0, 0)
    if (crop_left, crop_top, crop_right, crop_bottom) != (0, 0, sprite.width, sprite.height):
        sprite = sprite.crop((crop_left, crop_top, crop_right, crop_bottom))
        left += crop_left
        top += crop_top

    return sprite, (left, top)
