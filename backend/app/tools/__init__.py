"""Editor tool logic.

Every sidebar tool in the frontend is backed by a module here: the frontend
collects pointer gestures and slider values, and this package decides what they
mean and what the resulting pixels look like.

Module map, in the order the sidebar lists the tools:

``geometry``        Transform: aspect presets, flips, rotation, crop
``adjustments``     Adjust: the twelve sliders, as a tone curve
``filter_presets``  Filters: preset and variant definitions
``color_pipeline``  Applies Adjust and Filters together
``focus_effects``   Focus: gradient-masked selective blur
``text_designs``    Text Design: the sixteen templates
``layer_painter``   Rasterises text, text-design, and brush layers
``ai_support``      Magic Edit, Art Style, Upscaler, Border Expander helpers
``renderer``        Composites everything into a preview or a final image
``thumbnails``      Preview tiles for the Filters and Focus grids
``catalog``         The description of every control, served to the sidebar
"""

from .catalog import build_catalog
from .edit_document import EditDocument
from .renderer import DEFAULT_PREVIEW_EDGE, PreviewRender, compose, render_preview
from .thumbnails import filter_thumbnails, focus_thumbnails

__all__ = [
    "DEFAULT_PREVIEW_EDGE",
    "EditDocument",
    "PreviewRender",
    "build_catalog",
    "compose",
    "filter_thumbnails",
    "focus_thumbnails",
    "render_preview",
]
