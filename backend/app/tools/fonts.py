"""Font catalog for the Text and Text Design tools.

The sidebar offers stable family keys ("display", "serif", ...); this module is
the only place that knows which file on disk backs each one. Every family lists
several candidate files so the renderer degrades gracefully on a machine that
ships a different font package.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from PIL import ImageFont

FontStyle = str  # "regular" | "bold" | "italic" | "black"

_SEARCH_ROOTS = (
    Path("/usr/share/fonts"),
    Path("/usr/local/share/fonts"),
    Path.home() / ".local/share/fonts",
    Path("/Library/Fonts"),
    Path("/System/Library/Fonts"),
    Path("C:/Windows/Fonts"),
)

#: Ordered filename candidates per family and style. First match on disk wins.
_FAMILY_FILES: dict[str, dict[FontStyle, tuple[str, ...]]] = {
    "display": {
        "regular": ("Lato-Black.ttf", "DejaVuSans-Bold.ttf", "Arial Bold.ttf"),
        "bold": ("Lato-Black.ttf", "DejaVuSans-Bold.ttf"),
        "italic": ("Lato-BlackItalic.ttf", "DejaVuSans-BoldOblique.ttf"),
        "black": ("Lato-Black.ttf", "DejaVuSans-Bold.ttf"),
    },
    "sans": {
        "regular": ("Lato-Regular.ttf", "DejaVuSans.ttf", "Arial.ttf"),
        "bold": ("Lato-Bold.ttf", "DejaVuSans-Bold.ttf"),
        "italic": ("Lato-Italic.ttf", "DejaVuSans-Oblique.ttf"),
        "black": ("Lato-Black.ttf", "DejaVuSans-Bold.ttf"),
    },
    "serif": {
        "regular": ("DejaVuSerif.ttf", "Times New Roman.ttf"),
        "bold": ("DejaVuSerif-Bold.ttf",),
        "italic": ("DejaVuSerif-Italic.ttf",),
        "black": ("DejaVuSerif-Bold.ttf",),
    },
    "mono": {
        "regular": ("DejaVuSansMono.ttf", "UbuntuMono[wght].ttf", "Courier New.ttf"),
        "bold": ("DejaVuSansMono-Bold.ttf",),
        "italic": ("DejaVuSansMono-Oblique.ttf",),
        "black": ("DejaVuSansMono-Bold.ttf",),
    },
    "rounded": {
        "regular": ("Ubuntu[wdth,wght].ttf", "Ubuntu-Regular.ttf", "Lato-Regular.ttf"),
        "bold": ("Ubuntu-Bold.ttf", "Lato-Bold.ttf"),
        "italic": ("Ubuntu-Italic[wdth,wght].ttf", "Lato-Italic.ttf"),
        "black": ("Ubuntu-Bold.ttf", "Lato-Black.ttf"),
    },
    "script": {
        # No cursive face is guaranteed on Linux, so an italic serif stands in.
        "regular": ("DejaVuSerif-Italic.ttf", "Lato-Italic.ttf"),
        "bold": ("DejaVuSerif-BoldItalic.ttf", "Lato-BoldItalic.ttf"),
        "italic": ("DejaVuSerif-Italic.ttf", "Lato-Italic.ttf"),
        "black": ("DejaVuSerif-BoldItalic.ttf", "Lato-BoldItalic.ttf"),
    },
}

#: What the sidebar shows for each family key.
FONT_FAMILY_LABELS: dict[str, str] = {
    "display": "Display",
    "sans": "Sans",
    "serif": "Serif",
    "mono": "Mono",
    "rounded": "Rounded",
    "script": "Script",
}

DEFAULT_FAMILY = "display"


@lru_cache(maxsize=1)
def _installed_fonts() -> dict[str, Path]:
    """Index every font file on the machine by lowercase filename."""
    found: dict[str, Path] = {}
    for root in _SEARCH_ROOTS:
        if not root.is_dir():
            continue
        for path in root.rglob("*"):
            if path.suffix.lower() in (".ttf", ".otf", ".ttc"):
                found.setdefault(path.name.lower(), path)
    return found


@lru_cache(maxsize=256)
def font_file(family: str, style: FontStyle = "regular") -> Path | None:
    """Resolve a family and style to a font file, falling back across styles."""
    styles = _FAMILY_FILES.get(family) or _FAMILY_FILES[DEFAULT_FAMILY]
    installed = _installed_fonts()
    ordered = (style, "regular", "bold", "black", "italic")
    seen: set[str] = set()
    for candidate_style in ordered:
        if candidate_style in seen:
            continue
        seen.add(candidate_style)
        for filename in styles.get(candidate_style, ()):
            match = installed.get(filename.lower())
            if match is not None:
                return match
    return next(iter(installed.values()), None)


@lru_cache(maxsize=512)
def load_font(family: str, size: float, style: FontStyle = "regular") -> ImageFont.FreeTypeFont:
    """Load a sized font, never raising: the bitmap default is the last resort."""
    pixels = max(1, int(round(size)))
    path = font_file(family, style)
    if path is not None:
        try:
            return ImageFont.truetype(str(path), pixels)
        except OSError:
            pass
    return ImageFont.load_default(pixels)


def available_families() -> list[dict[str, str]]:
    """Families the sidebar can offer, limited to those actually resolvable."""
    return [
        {"id": key, "label": label}
        for key, label in FONT_FAMILY_LABELS.items()
        if font_file(key) is not None
    ]
