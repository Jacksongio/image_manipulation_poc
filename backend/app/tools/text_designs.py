"""The Text Design panel: 16 templates that lay out a few lines of type.

A template turns the user's lines into primitive rectangles and text runs
positioned inside a fixed width. :mod:`layer_painter` rasterises the result, so
nothing here needs to know about Pillow.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Literal

#: Family keys understood by :mod:`fonts`, named for the role they play here.
FAT = "display"
SLAB = "serif"
SCRIPT = "script"
MONO = "mono"
GROTESK = "sans"

FontStyle = Literal["regular", "bold", "italic", "black"]


@dataclass(frozen=True)
class RectNode:
    x: float
    y: float
    width: float
    height: float
    fill: str | None = None
    stroke: str | None = None
    stroke_width: float = 0
    corner_radius: float = 0
    #: Dash pattern as (dash length, gap length); None draws a solid outline.
    dash: tuple[float, float] | None = None


@dataclass(frozen=True)
class TextNode:
    x: float
    y: float
    width: float
    text: str
    font_size: float
    font_family: str
    font_style: FontStyle = "bold"
    fill: str = "#ffffff"
    align: Literal["left", "center", "right"] = "center"
    letter_spacing: float = 0
    stroke: str | None = None
    stroke_width: float = 0


DesignNode = RectNode | TextNode


@dataclass(frozen=True)
class DesignLayout:
    nodes: list[DesignNode]
    height: float


@dataclass(frozen=True)
class DesignContext:
    width: float
    lines: list[str]
    #: The colour picked in the panel.
    foreground: str
    #: The automatic contrasting colour used for bands and knockouts.
    background: str
    variant: int


@dataclass(frozen=True)
class TextDesignTemplate:
    id: str
    name: str
    line_count: int
    variant_count: int
    sample: tuple[str, ...]
    build: Callable[[DesignContext], DesignLayout] = field(compare=False)


def _fit_font_size(text: str, width: float, glyph_ratio: float, maximum: float) -> float:
    """Rough cap-height metrics, enough to size display type inside a fixed width."""
    length = max(1, len(text.strip()))
    return max(8.0, min(maximum, width / (length * glyph_ratio)))


def _line(index: int, lines: list[str], fallback: str) -> str:
    """The user's line, or the template's placeholder when it is blank."""
    if index < len(lines) and lines[index] and lines[index].strip():
        return lines[index]
    return fallback


def contrast_color(hex_color: str) -> str:
    """Black or white, whichever stays legible against the given colour."""
    value = hex_color.lstrip("#")
    if len(value) == 3:
        value = "".join(channel * 2 for channel in value)
    try:
        red = int(value[0:2], 16)
        green = int(value[2:4], 16)
        blue = int(value[4:6], 16)
    except (ValueError, IndexError):
        red = green = blue = 0
    luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
    return "#111111" if luminance > 0.55 else "#ffffff"


# --- Templates ---------------------------------------------------------------


def _ribbon(ctx: DesignContext) -> DesignLayout:
    top = _line(0, ctx.lines, "WRITE").upper()
    middle = _line(1, ctx.lines, "SOMETHING WITH").upper()
    bottom = _line(2, ctx.lines, "STYLE").upper()
    width = ctx.width
    top_size = _fit_font_size(top, width, 0.66, width * 0.42)
    bottom_size = _fit_font_size(bottom, width, 0.66, width * 0.42)
    band_size = _fit_font_size(middle, width * 0.78, 0.62, width * 0.13)
    band_height = band_size * 1.9
    notch = band_height * 0.42 if ctx.variant == 0 else 0.0

    nodes: list[DesignNode] = []
    y = 0.0
    nodes.append(TextNode(0, y, width, top, top_size, FAT, "bold", ctx.foreground))
    y += top_size * 1.05

    nodes.append(RectNode(notch, y, width - notch * 2, band_height, fill=ctx.foreground))
    if ctx.variant == 0:
        nodes.append(
            RectNode(0, y + band_height * 0.18, notch * 1.4, band_height * 0.64, fill=ctx.foreground)
        )
        nodes.append(
            RectNode(
                width - notch * 1.4,
                y + band_height * 0.18,
                notch * 1.4,
                band_height * 0.64,
                fill=ctx.foreground,
            )
        )
    nodes.append(
        TextNode(
            0,
            y + (band_height - band_size) / 2,
            width,
            middle,
            band_size,
            GROTESK if ctx.variant == 2 else FAT,
            "bold",
            ctx.background,
            letter_spacing=band_size * 0.08,
        )
    )
    y += band_height * 1.05

    nodes.append(TextNode(0, y, width, bottom, bottom_size, FAT, "bold", ctx.foreground))
    return DesignLayout(nodes, y + bottom_size * 1.05)


def _stack(ctx: DesignContext) -> DesignLayout:
    rows = [
        _line(0, ctx.lines, "EAT").upper(),
        _line(1, ctx.lines, "AND").upper(),
        _line(2, ctx.lines, "FAST").upper(),
    ]
    align = "center" if ctx.variant == 0 else "left"
    nodes: list[DesignNode] = []
    y = 0.0
    for index, text in enumerate(rows):
        ratio = 0.78 if index == 1 and ctx.variant == 1 else 0.6
        size = _fit_font_size(text, ctx.width, ratio, ctx.width * 0.4)
        nodes.append(TextNode(0, y, ctx.width, text, size, FAT, "bold", ctx.foreground, align))
        y += size * 1.02
    return DesignLayout(nodes, y)


def _boxed(ctx: DesignContext) -> DesignLayout:
    rows = [_line(0, ctx.lines, "SIMPLE").upper(), _line(1, ctx.lines, "FEELING").upper()]
    width = ctx.width
    border = max(2.0, width * (0.012 if ctx.variant == 0 else 0.024))
    padding = width * 0.08
    inner = width - padding * 2

    nodes: list[DesignNode] = []
    y = padding
    for text in rows:
        size = _fit_font_size(text, inner, 0.62, inner * 0.32)
        nodes.append(TextNode(padding, y, inner, text, size, FAT, "bold", ctx.foreground))
        y += size * 1.18
    height = y + padding - width * 0.02
    nodes.insert(0, RectNode(0, 0, width, height, stroke=ctx.foreground, stroke_width=border))
    return DesignLayout(nodes, height)


def _rule(ctx: DesignContext) -> DesignLayout:
    top = _line(0, ctx.lines, "TYPE").upper()
    bottom = _line(1, ctx.lines, "with Style")
    width = ctx.width
    top_size = _fit_font_size(top, width, 0.62, width * 0.36)
    bottom_size = _fit_font_size(bottom, width, 0.44, width * 0.2)
    rule_height = max(2.0, width * 0.012)

    nodes: list[DesignNode] = []
    y = 0.0
    nodes.append(TextNode(0, y, width, top, top_size, FAT, "bold", ctx.foreground))
    y += top_size * 1.12
    rule_x = 0.0 if ctx.variant == 0 else width * 0.2
    rule_width = width if ctx.variant == 0 else width * 0.6
    nodes.append(RectNode(rule_x, y, rule_width, rule_height, fill=ctx.foreground))
    y += rule_height + width * 0.03
    nodes.append(TextNode(0, y, width, bottom, bottom_size, SLAB, "italic", ctx.foreground))
    return DesignLayout(nodes, y + bottom_size * 1.1)


def _badge(ctx: DesignContext) -> DesignLayout:
    top = _line(0, ctx.lines, "THE").upper()
    middle = _line(1, ctx.lines, "BIG").upper()
    bottom = _line(2, ctx.lines, "SALE").upper()
    width = ctx.width
    small = width * 0.09
    rule_height = max(1.5, width * 0.008)

    nodes: list[DesignNode] = []
    y = 0.0
    nodes.append(
        TextNode(0, y, width, top, small, GROTESK, "bold", ctx.foreground, letter_spacing=small * 0.3)
    )
    y += small * 1.5
    nodes.append(RectNode(width * 0.3, y, width * 0.4, rule_height, fill=ctx.foreground))
    y += rule_height + width * 0.035
    big_size = _fit_font_size(middle, width, 0.6, width * 0.44)
    nodes.append(
        TextNode(0, y, width, middle, big_size, FAT if ctx.variant == 0 else SLAB, "bold", ctx.foreground)
    )
    y += big_size * 1.06
    nodes.append(RectNode(width * 0.3, y, width * 0.4, rule_height, fill=ctx.foreground))
    y += rule_height + width * 0.035
    nodes.append(
        TextNode(0, y, width, bottom, small, GROTESK, "bold", ctx.foreground, letter_spacing=small * 0.3)
    )
    return DesignLayout(nodes, y + small * 1.3)


def _pill(ctx: DesignContext) -> DesignLayout:
    top = _line(0, ctx.lines, "blue")
    bottom = _line(1, ctx.lines, "FRIDAY").upper()
    width = ctx.width
    top_size = _fit_font_size(top, width * 0.6, 0.5, width * 0.28)
    pill_height = top_size * 1.7
    pill_width = min(width, top_size * len(top) * 0.62 + top_size * 1.4)

    nodes: list[DesignNode] = []
    y = 0.0
    nodes.append(
        RectNode(
            (width - pill_width) / 2,
            y,
            pill_width,
            pill_height,
            fill=ctx.foreground,
            corner_radius=pill_height / 2 if ctx.variant == 0 else pill_height * 0.14,
        )
    )
    nodes.append(
        TextNode(
            0,
            y + (pill_height - top_size) / 2,
            width,
            top,
            top_size,
            SLAB if ctx.variant == 0 else FAT,
            "italic",
            ctx.background,
        )
    )
    y += pill_height + width * 0.03
    bottom_size = _fit_font_size(bottom, width, 0.6, width * 0.32)
    nodes.append(
        TextNode(
            0, y, width, bottom, bottom_size, FAT, "bold", ctx.foreground, letter_spacing=bottom_size * 0.06
        )
    )
    return DesignLayout(nodes, y + bottom_size * 1.1)


def _knockout(ctx: DesignContext) -> DesignLayout:
    rows = [_line(0, ctx.lines, "SPECIAL").upper(), _line(1, ctx.lines, "DEALS").upper()]
    width = ctx.width
    padding = width * 0.06
    inner = width - padding * 2

    nodes: list[DesignNode] = []
    y = padding
    for text in rows:
        size = _fit_font_size(text, inner, 0.62, inner * 0.3)
        nodes.append(TextNode(padding, y, inner, text, size, FAT, "bold", ctx.background))
        y += size * 1.2
    height = y + padding - width * 0.02
    nodes.insert(
        0,
        RectNode(
            0, 0, width, height, fill=ctx.foreground, corner_radius=0 if ctx.variant == 0 else width * 0.06
        ),
    )
    return DesignLayout(nodes, height)


def _outline(ctx: DesignContext) -> DesignLayout:
    rows = [_line(0, ctx.lines, "DOUBLE").upper(), _line(1, ctx.lines, "LINES").upper()]
    nodes: list[DesignNode] = []
    y = 0.0
    for index, text in enumerate(rows):
        size = _fit_font_size(text, ctx.width, 0.62, ctx.width * 0.34)
        hollow = index == 0 if ctx.variant == 0 else True
        nodes.append(
            TextNode(
                0,
                y,
                ctx.width,
                text,
                size,
                FAT,
                "bold",
                "transparent" if hollow else ctx.foreground,
                stroke=ctx.foreground,
                stroke_width=max(1.5, size * 0.045),
            )
        )
        y += size * 1.06
    return DesignLayout(nodes, y)


def _script(ctx: DesignContext) -> DesignLayout:
    top = _line(0, ctx.lines, "Chillin' with my")
    bottom = _line(1, ctx.lines, "GNOMIES").upper()
    width = ctx.width
    top_size = _fit_font_size(top, width, 0.4, width * 0.22)
    bottom_size = _fit_font_size(bottom, width, 0.6, width * 0.34)

    nodes: list[DesignNode] = []
    y = 0.0
    nodes.append(
        TextNode(
            0,
            y,
            width,
            top,
            top_size,
            SCRIPT,
            "regular",
            ctx.foreground,
            "center" if ctx.variant == 0 else "left",
        )
    )
    y += top_size * 1.1
    nodes.append(TextNode(0, y, width, bottom, bottom_size, FAT, "bold", ctx.foreground))
    return DesignLayout(nodes, y + bottom_size * 1.08)


def _condensed(ctx: DesignContext) -> DesignLayout:
    text = _line(0, ctx.lines, "DEKO").upper()
    size = _fit_font_size(text, ctx.width, 0.58 if ctx.variant == 0 else 0.68, ctx.width * 0.6)
    node = TextNode(
        0,
        0,
        ctx.width,
        text,
        size,
        FAT,
        "bold",
        ctx.foreground,
        letter_spacing=size * 0.1 if ctx.variant == 1 else 0,
    )
    return DesignLayout([node], size * 1.1)


def _double_line(ctx: DesignContext) -> DesignLayout:
    rows = [_line(0, ctx.lines, "BEER AND").upper(), _line(1, ctx.lines, "BURGERS").upper()]
    width = ctx.width
    rule_height = max(2.0, width * (0.014 if ctx.variant == 0 else 0.02))
    gap = rule_height * 2

    nodes: list[DesignNode] = []
    y = 0.0
    nodes.append(RectNode(0, y, width, rule_height, fill=ctx.foreground))
    nodes.append(RectNode(0, y + rule_height + gap, width, rule_height, fill=ctx.foreground))
    y += rule_height * 2 + gap + width * 0.04
    for text in rows:
        size = _fit_font_size(text, width, 0.62, width * 0.3)
        nodes.append(TextNode(0, y, width, text, size, FAT, "bold", ctx.foreground))
        y += size * 1.08
    y += width * 0.03
    nodes.append(RectNode(0, y, width, rule_height, fill=ctx.foreground))
    nodes.append(RectNode(0, y + rule_height + gap, width, rule_height, fill=ctx.foreground))
    return DesignLayout(nodes, y + rule_height * 2 + gap)


def _ticket(ctx: DesignContext) -> DesignLayout:
    rows = [_line(0, ctx.lines, "PARTY").upper(), _line(1, ctx.lines, "TONIGHT").upper()]
    width = ctx.width
    border = max(2.0, width * 0.011)
    padding = width * 0.09
    inner = width - padding * 2

    nodes: list[DesignNode] = []
    y = padding
    for index, text in enumerate(rows):
        size = _fit_font_size(text, inner, 0.6 if index == 0 else 0.5, inner * 0.28)
        nodes.append(
            TextNode(
                padding,
                y,
                inner,
                text,
                size,
                FAT if index == 0 else MONO,
                "bold",
                ctx.foreground,
                letter_spacing=size * 0.2 if index == 1 else 0,
            )
        )
        y += size * 1.24
    height = y + padding - width * 0.03
    nodes.insert(
        0,
        RectNode(
            0,
            0,
            width,
            height,
            stroke=ctx.foreground,
            stroke_width=border,
            dash=(border * 3, border * 2.2) if ctx.variant == 0 else None,
        ),
    )
    return DesignLayout(nodes, height)


def _corner(ctx: DesignContext) -> DesignLayout:
    rows = [_line(0, ctx.lines, "THE").upper(), _line(1, ctx.lines, "TEAM").upper()]
    width = ctx.width
    rule_size = max(2.0, width * 0.014)
    arm = width * (0.22 if ctx.variant == 0 else 0.34)
    padding = width * 0.1
    inner = width - padding * 2

    nodes: list[DesignNode] = []
    y = padding
    for text in rows:
        size = _fit_font_size(text, inner, 0.6, inner * 0.34)
        nodes.append(TextNode(padding, y, inner, text, size, FAT, "bold", ctx.foreground))
        y += size * 1.12
    height = y + padding - width * 0.02
    nodes.extend(
        [
            RectNode(0, 0, arm, rule_size, fill=ctx.foreground),
            RectNode(0, 0, rule_size, arm, fill=ctx.foreground),
            RectNode(width - arm, height - rule_size, arm, rule_size, fill=ctx.foreground),
            RectNode(width - rule_size, height - arm, rule_size, arm, fill=ctx.foreground),
        ]
    )
    return DesignLayout(nodes, height)


def _minimal(ctx: DesignContext) -> DesignLayout:
    top = _line(0, ctx.lines, "SPACED").upper()
    bottom = _line(1, ctx.lines, "apart")
    width = ctx.width
    top_size = _fit_font_size(top, width * 0.9, 0.78, width * 0.16)
    bottom_size = top_size * 0.62
    rule_height = max(1.0, width * 0.005)

    nodes: list[DesignNode] = []
    y = 0.0
    nodes.append(
        TextNode(
            0, y, width, top, top_size, GROTESK, "bold", ctx.foreground, letter_spacing=top_size * 0.42
        )
    )
    y += top_size * 1.5
    rule_x = width * (0.38 if ctx.variant == 0 else 0.1)
    rule_width = width * (0.24 if ctx.variant == 0 else 0.8)
    nodes.append(RectNode(rule_x, y, rule_width, rule_height, fill=ctx.foreground))
    y += rule_height + width * 0.045
    nodes.append(TextNode(0, y, width, bottom, bottom_size, SLAB, "italic", ctx.foreground))
    return DesignLayout(nodes, y + bottom_size * 1.2)


def _shout(ctx: DesignContext) -> DesignLayout:
    candidates = [
        _line(0, ctx.lines, "FAT"),
        _line(1, ctx.lines, "FACE"),
        ctx.lines[2] if len(ctx.lines) > 2 else "",
    ]
    rows = [value.upper() for value in candidates if value.strip()]
    align = "center" if ctx.variant == 0 else "left"

    nodes: list[DesignNode] = []
    y = 0.0
    for text in rows:
        size = _fit_font_size(text, ctx.width, 0.58, ctx.width * 0.56)
        nodes.append(TextNode(0, y, ctx.width, text, size, FAT, "bold", ctx.foreground, align))
        y += size * 0.94
    return DesignLayout(nodes, y + ctx.width * 0.02)


def _tag(ctx: DesignContext) -> DesignLayout:
    top = _line(0, ctx.lines, "NEW").upper()
    bottom = _line(1, ctx.lines, "ARRIVALS").upper()
    width = ctx.width
    bottom_size = _fit_font_size(bottom, width, 0.6, width * 0.3)
    tag_size = bottom_size * 0.46
    tag_height = tag_size * 1.9
    tag_width = tag_size * len(top) * 0.72 + tag_size * 1.6
    tag_x = (width - tag_width) / 2 if ctx.variant == 0 else 0.0

    nodes: list[DesignNode] = []
    y = 0.0
    nodes.append(
        RectNode(tag_x, y, tag_width, tag_height, fill=ctx.foreground, corner_radius=tag_height * 0.18)
    )
    nodes.append(
        TextNode(
            tag_x,
            y + (tag_height - tag_size) / 2,
            tag_width,
            top,
            tag_size,
            GROTESK,
            "bold",
            ctx.background,
            letter_spacing=tag_size * 0.16,
        )
    )
    y += tag_height + width * 0.035
    nodes.append(
        TextNode(
            0,
            y,
            width,
            bottom,
            bottom_size,
            FAT,
            "bold",
            ctx.foreground,
            "center" if ctx.variant == 0 else "left",
        )
    )
    return DesignLayout(nodes, y + bottom_size * 1.08)


TEXT_DESIGN_TEMPLATES: tuple[TextDesignTemplate, ...] = (
    TextDesignTemplate("ribbon", "Ribbon", 3, 3, ("THIS", "IS THE", "BEST"), _ribbon),
    TextDesignTemplate("stack", "Stack", 3, 2, ("EAT AND", "FAST"), _stack),
    TextDesignTemplate("boxed", "Boxed", 2, 2, ("SIMPLE", "FEELING"), _boxed),
    TextDesignTemplate("rule", "Rule", 2, 2, ("TYPE", "with Style"), _rule),
    TextDesignTemplate("badge", "Badge", 3, 2, ("THE", "BIG", "SALE"), _badge),
    TextDesignTemplate("pill", "Pill", 2, 2, ("blue", "FRIDAY"), _pill),
    TextDesignTemplate("knockout", "Knockout", 2, 2, ("SPECIAL", "DEALS"), _knockout),
    TextDesignTemplate("outline", "Outline", 2, 2, ("DOUBLE", "LINES"), _outline),
    TextDesignTemplate("script", "Script", 2, 2, ("Chillin' with", "GNOMIES"), _script),
    TextDesignTemplate("condensed", "Condensed", 1, 2, ("DEKO",), _condensed),
    TextDesignTemplate("double-line", "Double Line", 2, 2, ("BEER AND", "BURGERS"), _double_line),
    TextDesignTemplate("ticket", "Ticket", 2, 2, ("PARTY", "TONIGHT"), _ticket),
    TextDesignTemplate("corner", "Corner", 2, 2, ("THE", "TEAM"), _corner),
    TextDesignTemplate("minimal", "Minimal", 2, 2, ("SPACED", "apart"), _minimal),
    TextDesignTemplate("shout", "Shout", 3, 2, ("FAT", "FACE"), _shout),
    TextDesignTemplate("tag", "Tag", 2, 2, ("NEW", "ARRIVALS"), _tag),
)

_TEMPLATES_BY_ID = {template.id: template for template in TEXT_DESIGN_TEMPLATES}


def find_template(template_id: str) -> TextDesignTemplate:
    """Look up a template, falling back to the first so rendering never fails."""
    return _TEMPLATES_BY_ID.get(template_id, TEXT_DESIGN_TEMPLATES[0])


def build_text_design(
    template_id: str,
    width: float,
    lines: list[str],
    color: str,
    inverted: bool = False,
    variant: int = 0,
) -> DesignLayout:
    """Lay out one text design at the given width."""
    template = find_template(template_id)
    contrast = contrast_color(color)
    return template.build(
        DesignContext(
            width=width,
            lines=lines,
            foreground=contrast if inverted else color,
            background=color if inverted else contrast,
            variant=variant % template.variant_count,
        )
    )
