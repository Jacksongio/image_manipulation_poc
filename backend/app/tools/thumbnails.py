"""Preview tiles for the Filters and Focus grids.

Both panels show the user's own image treated every possible way, so the tiles
are generated from one small square crop rather than the full frame.
"""

from __future__ import annotations

from PIL import Image

from .color_pipeline import apply_pipeline, build_pipeline
from .edit_document import Adjustments
from .filter_presets import all_filter_ids
from .focus_effects import FOCUS_TYPES, apply_focus, default_focus
from .layer_painter import render_design_layout
from .text_designs import TEXT_DESIGN_TEMPLATES, build_text_design

#: Tile edge in pixels. Matches the two-column sidebar grid at 2x density.
THUMBNAIL_SIZE = 160

#: Width the design templates lay out at before being scaled into a tile.
_DESIGN_LAYOUT_WIDTH = 200

_NEUTRAL_ADJUSTMENTS = Adjustments()


def square_crop(image: Image.Image, size: int = THUMBNAIL_SIZE) -> Image.Image:
    """Centre-crop to a square and downscale, ready for tiling."""
    edge = min(image.width, image.height)
    left = (image.width - edge) // 2
    top = (image.height - edge) // 2
    return image.crop((left, top, left + edge, top + edge)).resize(
        (size, size), Image.Resampling.LANCZOS
    )


def filter_thumbnails(image: Image.Image, size: int = THUMBNAIL_SIZE) -> dict[str, Image.Image]:
    """One tile per selectable filter identifier, at full preset strength."""
    base = square_crop(image, size).convert("RGB")
    tiles: dict[str, Image.Image] = {}
    for identifier in all_filter_ids():
        pipeline = build_pipeline(_NEUTRAL_ADJUSTMENTS, identifier, 100)
        tiles[identifier] = apply_pipeline(base, pipeline)
    return tiles


def focus_thumbnails(image: Image.Image, size: int = THUMBNAIL_SIZE) -> dict[str, Image.Image]:
    """One tile per focus type, using each type's default geometry."""
    base = square_crop(image, size).convert("RGB")
    tiles: dict[str, Image.Image] = {}
    for entry in FOCUS_TYPES:
        focus_type = entry["id"]
        focus = default_focus(size, size, focus_type)
        # Preview at a stronger setting than the default so the shape reads.
        tiles[focus_type] = apply_focus(base, focus.model_copy(update={"intensity": 55}))
    return tiles


def text_design_thumbnails(color: str, size: int = THUMBNAIL_SIZE) -> dict[str, Image.Image]:
    """One transparent tile per template, showing its sample text."""
    tiles: dict[str, Image.Image] = {}
    for template in TEXT_DESIGN_TEMPLATES:
        layout = build_text_design(
            template.id, _DESIGN_LAYOUT_WIDTH, list(template.sample), color
        )
        rendered = render_design_layout(layout, _DESIGN_LAYOUT_WIDTH)

        scale = min(size * 0.86 / rendered.width, size * 0.82 / max(1, rendered.height))
        scaled = rendered.resize(
            (max(1, round(rendered.width * scale)), max(1, round(rendered.height * scale))),
            Image.Resampling.LANCZOS,
        )
        tile = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        tile.alpha_composite(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2))
        tiles[template.id] = tile
    return tiles
