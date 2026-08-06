"""The single description of every sidebar control, served to the frontend.

The editor UI renders itself from this payload, so adding a filter preset or a
text-design template here makes it appear in the sidebar with no frontend change.
"""

from __future__ import annotations

from .adjustments import ADJUSTMENT_GROUPS, SLIDER_RANGE
from .ai_support import ART_STYLES, MAGIC_EDIT_OPERATIONS, PRINT_SIZES, STYLE_INTENSITIES
from .filter_presets import FILTER_PRESETS, filter_id
from .focus_effects import FOCUS_TYPES
from .fonts import DEFAULT_FAMILY, available_families
from .geometry import ASPECT_PRESETS
from .text_designs import TEXT_DESIGN_TEMPLATES
from ..gemini import image_model_options

#: Swatches offered by the Text, Text Design, and Brush colour rows.
COLOR_SWATCHES: tuple[str, ...] = (
    "#ffffff",
    "#111111",
    "#e02020",
    "#f5a623",
    "#f8e71c",
    "#7ed321",
    "#4a90e2",
    "#9013fe",
    "#ff6b9d",
    "#00d4c8",
)

#: Defaults the Brush panel starts from.
BRUSH_DEFAULTS = {"size": 40, "hardness": 50, "color": "#e02020"}

#: Defaults a new text layer starts from.
TEXT_DEFAULTS = {
    "fontFamily": DEFAULT_FAMILY,
    "fontSize": 48,
    "fill": "#ffffff",
    "background": "transparent",
    "align": "center",
    "lineHeight": 1.0,
}


def _filters_payload() -> list[dict[str, object]]:
    return [
        {
            "id": preset.id,
            "label": preset.name,
            "spansFullWidth": preset.spans_full_width,
            "variants": [
                {"id": filter_id(preset, variant), "label": variant.name}
                for variant in preset.variants
            ],
        }
        for preset in FILTER_PRESETS
    ]


def _text_designs_payload() -> list[dict[str, object]]:
    return [
        {
            "id": template.id,
            "label": template.name,
            "lineCount": template.line_count,
            "variantCount": template.variant_count,
            "sample": list(template.sample),
        }
        for template in TEXT_DESIGN_TEMPLATES
    ]


def _print_sizes_payload() -> list[dict[str, object]]:
    return [
        {
            "id": key,
            "label": entry["label"],
            "detail": entry["detail"],
            "portrait": {"width": entry["portrait"][0], "height": entry["portrait"][1]},  # type: ignore[index]
            "landscape": {"width": entry["landscape"][0], "height": entry["landscape"][1]},  # type: ignore[index]
        }
        for key, entry in PRINT_SIZES.items()
    ]


def build_catalog() -> dict[str, object]:
    """Everything the sidebar needs to render its controls."""
    return {
        "adjust": {"groups": [dict(group) for group in ADJUSTMENT_GROUPS], "range": SLIDER_RANGE},
        "filters": _filters_payload(),
        "transform": {
            "aspectPresets": [
                {"id": preset.id, "label": preset.label, "ratio": preset.ratio}
                for preset in ASPECT_PRESETS
            ]
        },
        "focus": {"types": [dict(entry) for entry in FOCUS_TYPES]},
        "text": {"fontFamilies": available_families(), "defaults": TEXT_DEFAULTS},
        "textDesigns": _text_designs_payload(),
        "brush": {"defaults": BRUSH_DEFAULTS},
        "colorSwatches": list(COLOR_SWATCHES),
        "ai": {
            "artStyles": [dict(entry) for entry in ART_STYLES],
            "styleIntensities": [dict(entry) for entry in STYLE_INTENSITIES],
            "magicEditOperations": [dict(entry) for entry in MAGIC_EDIT_OPERATIONS],
            "imageModels": image_model_options(),
            "printSizes": _print_sizes_payload(),
            "upscaleScales": [2, 4],
        },
    }
