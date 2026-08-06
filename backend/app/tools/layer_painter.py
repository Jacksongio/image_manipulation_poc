"""Rasterises editor layers into transparent sprites.

Each layer becomes a standalone RGBA image plus the offset it should sit at.
The frontend only ever translates, rotates, and scales these sprites, which
keeps dragging responsive while all layout stays here.
"""

from __future__ import annotations

from dataclasses import dataclass

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from .edit_document import BrushStrokeLayer, TextDesignLayer, TextLayer
from .fonts import load_font
from .text_designs import DesignLayout, RectNode, TextNode, build_text_design

Rgba = tuple[int, int, int, int]

TRANSPARENT: Rgba = (0, 0, 0, 0)

_NAMED_COLORS: dict[str, Rgba] = {
    "transparent": TRANSPARENT,
    "none": TRANSPARENT,
    "black": (0, 0, 0, 255),
    "white": (255, 255, 255, 255),
}


@dataclass(frozen=True)
class PaintedLayer:
    """A rasterised layer and where its top-left corner belongs."""

    id: str
    image: Image.Image
    x: float
    y: float
    #: Layout size before the frontend applies scale; equals the image size.
    width: float
    height: float


def parse_color(value: str | None) -> Rgba:
    """Accept the CSS colour spellings the panels can produce."""
    if not value:
        return TRANSPARENT
    text = value.strip().lower()
    if text in _NAMED_COLORS:
        return _NAMED_COLORS[text]
    if text.startswith("#"):
        digits = text[1:]
        if len(digits) == 3:
            digits = "".join(channel * 2 for channel in digits)
        if len(digits) in (6, 8):
            try:
                red = int(digits[0:2], 16)
                green = int(digits[2:4], 16)
                blue = int(digits[4:6], 16)
                alpha = int(digits[6:8], 16) if len(digits) == 8 else 255
                return (red, green, blue, alpha)
            except ValueError:
                return TRANSPARENT
    if text.startswith("rgb"):
        try:
            parts = text[text.index("(") + 1 : text.index(")")].split(",")
            values = [float(part.strip()) for part in parts]
            alpha = int(values[3] * 255) if len(values) > 3 else 255
            return (int(values[0]), int(values[1]), int(values[2]), alpha)
        except (ValueError, IndexError):
            return TRANSPARENT
    return TRANSPARENT


def _is_visible(color: Rgba) -> bool:
    return color[3] > 0


def _run_width(text: str, font: ImageFont.FreeTypeFont, letter_spacing: float) -> float:
    """Advance width of a text run, including manual letter spacing."""
    if not text:
        return 0.0
    if letter_spacing == 0:
        return font.getlength(text)
    return sum(font.getlength(char) for char in text) + letter_spacing * (len(text) - 1)


def _wrap(text: str, font: ImageFont.FreeTypeFont, max_width: float, letter_spacing: float) -> list[str]:
    """Greedy word wrap, preserving the user's own line breaks."""
    wrapped: list[str] = []
    for paragraph in text.split("\n"):
        words = paragraph.split(" ")
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip() if current else word
            if current and _run_width(candidate, font, letter_spacing) > max_width:
                wrapped.append(current)
                current = word
            else:
                current = candidate
        wrapped.append(current)
    return wrapped or [""]


def _aligned_x(
    box_x: float, box_width: float, run_width: float, align: str
) -> float:
    if align == "center":
        return box_x + (box_width - run_width) / 2
    if align == "right":
        return box_x + box_width - run_width
    return box_x


def _draw_run(
    draw: ImageDraw.ImageDraw,
    x: float,
    y: float,
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: Rgba,
    letter_spacing: float = 0,
    stroke: Rgba = TRANSPARENT,
    stroke_width: float = 0,
) -> None:
    """Draw one line, stepping per character only when letter spacing applies."""
    outline = int(round(stroke_width)) if _is_visible(stroke) else 0
    common = {
        "font": font,
        "anchor": "la",
        "fill": fill,
        "stroke_width": outline,
        "stroke_fill": stroke if outline else None,
    }
    if letter_spacing == 0:
        draw.text((x, y), text, **common)  # type: ignore[arg-type]
        return
    cursor = x
    for char in text:
        draw.text((cursor, y), char, **common)  # type: ignore[arg-type]
        cursor += font.getlength(char) + letter_spacing


def _draw_dashed_rectangle(
    draw: ImageDraw.ImageDraw,
    box: tuple[float, float, float, float],
    color: Rgba,
    width: float,
    dash: tuple[float, float],
) -> None:
    """Pillow has no dash support, so walk the perimeter drawing segments."""
    left, top, right, bottom = box
    dash_length, gap_length = max(1.0, dash[0]), max(1.0, dash[1])
    thickness = max(1, int(round(width)))
    edges = (
        ((left, top), (right, top)),
        ((right, top), (right, bottom)),
        ((right, bottom), (left, bottom)),
        ((left, bottom), (left, top)),
    )
    for (start_x, start_y), (end_x, end_y) in edges:
        span = max(abs(end_x - start_x), abs(end_y - start_y))
        if span <= 0:
            continue
        step_x = (end_x - start_x) / span
        step_y = (end_y - start_y) / span
        position = 0.0
        while position < span:
            segment_end = min(span, position + dash_length)
            draw.line(
                [
                    (start_x + step_x * position, start_y + step_y * position),
                    (start_x + step_x * segment_end, start_y + step_y * segment_end),
                ],
                fill=color,
                width=thickness,
            )
            position = segment_end + gap_length


def paint_text_layer(layer: TextLayer) -> PaintedLayer:
    """Render an editable text box: optional background plus wrapped lines."""
    font = load_font(layer.font_family, layer.font_size)
    lines = _wrap(layer.text or " ", font, layer.width, 0)
    line_height = layer.font_size * layer.line_height * 1.2
    width = max(1, int(round(layer.width)))
    height = max(1, int(round(line_height * len(lines))))

    canvas = Image.new("RGBA", (width, height), TRANSPARENT)
    draw = ImageDraw.Draw(canvas)

    background = parse_color(layer.background)
    if _is_visible(background):
        draw.rectangle((0, 0, width, height), fill=background)

    fill = parse_color(layer.fill)
    align = "left" if layer.align == "justify" else layer.align
    for index, line in enumerate(lines):
        run_width = _run_width(line, font, 0)
        x = _aligned_x(0, width, run_width, align)
        _draw_run(draw, x, index * line_height, line, font, fill)

    return PaintedLayer(layer.id, canvas, layer.x, layer.y, width, height)


def render_design_layout(layout: DesignLayout, width: float) -> Image.Image:
    """Rasterise a text-design layout onto its own transparent canvas."""
    canvas = Image.new(
        "RGBA", (max(1, int(round(width))), max(1, int(round(layout.height)))), TRANSPARENT
    )
    draw = ImageDraw.Draw(canvas)
    for node in layout.nodes:
        if isinstance(node, RectNode):
            _paint_rect_node(draw, node)
        else:
            _paint_text_node(draw, node)
    return canvas


def paint_text_design_layer(layer: TextDesignLayer) -> PaintedLayer:
    """Render one text-design template into a sprite."""
    layout = build_text_design(
        layer.template,
        layer.width,
        list(layer.lines),
        layer.color,
        layer.inverted,
        layer.variant,
    )
    canvas = render_design_layout(layout, layer.width)
    return PaintedLayer(layer.id, canvas, layer.x, layer.y, canvas.width, canvas.height)


def _paint_rect_node(draw: ImageDraw.ImageDraw, node: RectNode) -> None:
    box = (node.x, node.y, node.x + node.width, node.y + node.height)
    fill = parse_color(node.fill)
    stroke = parse_color(node.stroke)

    if node.dash is not None and _is_visible(stroke):
        _draw_dashed_rectangle(draw, box, stroke, node.stroke_width, node.dash)
        return

    outline = stroke if _is_visible(stroke) else None
    thickness = max(1, int(round(node.stroke_width))) if outline else 0
    if node.corner_radius > 0:
        draw.rounded_rectangle(
            box,
            radius=node.corner_radius,
            fill=fill if _is_visible(fill) else None,
            outline=outline,
            width=thickness,
        )
    else:
        draw.rectangle(
            box,
            fill=fill if _is_visible(fill) else None,
            outline=outline,
            width=thickness,
        )


def _paint_text_node(draw: ImageDraw.ImageDraw, node: TextNode) -> None:
    font = load_font(node.font_family, node.font_size, node.font_style)
    run_width = _run_width(node.text, font, node.letter_spacing)
    x = _aligned_x(node.x, node.width, run_width, node.align)
    _draw_run(
        draw,
        x,
        node.y,
        node.text,
        font,
        parse_color(node.fill),
        node.letter_spacing,
        parse_color(node.stroke),
        node.stroke_width,
    )


def paint_stroke_layer(layer: BrushStrokeLayer) -> PaintedLayer | None:
    """Rasterise a freehand brush stroke, cropped to its own bounding box."""
    points = list(zip(layer.points[0::2], layer.points[1::2]))
    if not points:
        return None

    softness = (1.0 - layer.hardness / 100.0) * layer.size * 0.5
    padding = layer.size / 2 + softness * 3 + 2
    min_x = min(x for x, _ in points) - padding
    min_y = min(y for _, y in points) - padding
    max_x = max(x for x, _ in points) + padding
    max_y = max(y for _, y in points) + padding

    width = max(1, int(round(max_x - min_x)))
    height = max(1, int(round(max_y - min_y)))
    local = [(x - min_x, y - min_y) for x, y in points]

    canvas = Image.new("RGBA", (width, height), TRANSPARENT)
    draw = ImageDraw.Draw(canvas)
    color = parse_color(layer.color)
    thickness = max(1, int(round(layer.size)))

    if len(local) == 1:
        radius = thickness / 2
        centre_x, centre_y = local[0]
        draw.ellipse(
            (centre_x - radius, centre_y - radius, centre_x + radius, centre_y + radius), fill=color
        )
    else:
        draw.line(local, fill=color, width=thickness, joint="curve")
        # `joint="curve"` rounds the interior joins but leaves the ends square.
        radius = thickness / 2
        for centre_x, centre_y in (local[0], local[-1]):
            draw.ellipse(
                (centre_x - radius, centre_y - radius, centre_x + radius, centre_y + radius), fill=color
            )

    if softness > 0.5:
        canvas = canvas.filter(ImageFilter.GaussianBlur(softness))

    return PaintedLayer(layer.id, canvas, min_x, min_y, width, height)


def paint_layer(layer: TextLayer | TextDesignLayer | BrushStrokeLayer) -> PaintedLayer | None:
    """Rasterise whichever layer kind was handed in."""
    if isinstance(layer, TextLayer):
        return paint_text_layer(layer)
    if isinstance(layer, TextDesignLayer):
        return paint_text_design_layer(layer)
    return paint_stroke_layer(layer)
