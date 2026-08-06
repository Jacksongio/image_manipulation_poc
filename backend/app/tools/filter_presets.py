"""Filter presets for the Filters panel.

A preset is one tile in the sidebar grid; presets with several variants show a
pop-out menu. The identifier the frontend round-trips is ``preset`` for the
default variant and ``preset/variant`` for any other.
"""

from __future__ import annotations

from dataclasses import dataclass, field

Rgb = tuple[float, float, float]


@dataclass(frozen=True)
class DuotoneRamp:
    """Maps luminance onto a shadow-to-highlight colour ramp."""

    shadow: Rgb
    highlight: Rgb
    mix: float = 1.0


@dataclass(frozen=True)
class Grade:
    """A colour treatment layered on top of the user's own adjustments."""

    #: Adjustment slider offsets, added to whatever the user has dialled in.
    adjustments: dict[str, float] = field(default_factory=dict)
    #: Per-channel gains applied after the tonal curve, 1.0 is neutral.
    gain: Rgb = (1.0, 1.0, 1.0)
    #: Per-channel offsets in 0..1 units, applied after the gains.
    offset: Rgb = (0.0, 0.0, 0.0)
    #: Mixes the result toward pure luminance.
    mono: float = 0.0
    duotone: DuotoneRamp | None = None
    #: Lifts the black point for a washed, faded look.
    fade: float = 0.0


@dataclass(frozen=True)
class FilterVariant:
    id: str
    name: str
    grade: Grade


@dataclass(frozen=True)
class FilterPreset:
    id: str
    name: str
    variants: tuple[FilterVariant, ...]
    #: Whether the tile spans the full width of the two-column grid.
    spans_full_width: bool = False


def _duotone(shadow: Rgb, highlight: Rgb) -> Grade:
    return Grade(duotone=DuotoneRamp(shadow, highlight), adjustments={"contrast": 10})


FILTER_PRESETS: tuple[FilterPreset, ...] = (
    FilterPreset(
        id="duotone",
        name="DuoTone",
        spans_full_width=True,
        variants=(
            FilterVariant("desert", "Desert", _duotone((76, 28, 13), (255, 209, 131))),
            FilterVariant("peach", "Peach", _duotone((68, 26, 42), (255, 190, 196))),
            FilterVariant("clash", "Clash", _duotone((36, 15, 59), (255, 68, 47))),
            FilterVariant("plum", "Plum", _duotone((25, 21, 73), (162, 138, 255))),
            FilterVariant("breezy", "Breezy", _duotone((9, 52, 64), (160, 237, 239))),
            FilterVariant("deep-blue", "Deep Blue", _duotone((7, 22, 74), (116, 164, 255))),
            FilterVariant("frog", "Frog", _duotone((30, 58, 24), (126, 235, 109))),
            FilterVariant("sunset", "Sunset", _duotone((94, 21, 53), (255, 154, 88))),
        ),
    ),
    FilterPreset(
        id="bw",
        name="B & W",
        spans_full_width=True,
        variants=(
            FilterVariant("neutral", "Neutral", Grade(mono=1, adjustments={"contrast": 8})),
            FilterVariant(
                "contrast",
                "High Contrast",
                Grade(mono=1, adjustments={"contrast": 42, "blacks": 20, "whites": 16}),
            ),
            FilterVariant(
                "soft",
                "Soft",
                Grade(mono=1, adjustments={"contrast": -16, "brightness": 8}, fade=0.08),
            ),
            FilterVariant(
                "film",
                "Film",
                Grade(mono=1, adjustments={"contrast": 22, "shadows": 12}, fade=0.05),
            ),
        ),
    ),
    FilterPreset(
        id="vintage",
        name="Vintage",
        spans_full_width=True,
        variants=(
            FilterVariant(
                "1920s",
                "1920s",
                Grade(
                    adjustments={"saturation": -42, "contrast": 18, "blacks": 10, "clarity": 8},
                    gain=(1.1, 1.02, 0.86),
                    fade=0.08,
                ),
            ),
            FilterVariant(
                "1930s",
                "1930s",
                Grade(
                    adjustments={"saturation": -36, "contrast": 6, "shadows": 10},
                    gain=(1.08, 1.0, 0.88),
                    fade=0.12,
                ),
            ),
            FilterVariant(
                "1940s",
                "1940s",
                Grade(
                    adjustments={"temperature": 12, "saturation": -24, "contrast": 20, "clarity": 10},
                    gain=(1.08, 1.01, 0.9),
                    fade=0.06,
                ),
            ),
            FilterVariant(
                "1950s",
                "1950s",
                Grade(
                    adjustments={"temperature": 16, "saturation": 6, "contrast": 18, "highlights": 12},
                    gain=(1.09, 1.02, 0.92),
                    fade=0.04,
                ),
            ),
            FilterVariant(
                "1960s",
                "1960s",
                Grade(
                    adjustments={"temperature": 10, "saturation": 22, "contrast": 10, "gamma": 8},
                    gain=(1.04, 1.03, 0.95),
                    fade=0.04,
                ),
            ),
            FilterVariant(
                "1970s",
                "1970s",
                Grade(
                    adjustments={"temperature": 24, "saturation": -10, "contrast": -8},
                    gain=(1.1, 1.0, 0.89),
                    fade=0.1,
                ),
            ),
            FilterVariant(
                "1980s",
                "1980s",
                Grade(
                    adjustments={"temperature": 4, "saturation": 30, "contrast": 26, "clarity": 12},
                    gain=(1.03, 1.0, 1.03),
                    fade=0.02,
                ),
            ),
            FilterVariant(
                "1990s",
                "1990s",
                Grade(
                    adjustments={"saturation": -8, "contrast": 14, "shadows": 18, "clarity": -8},
                    gain=(1.02, 1.01, 0.98),
                    fade=0.06,
                ),
            ),
        ),
    ),
    FilterPreset(
        id="smooth",
        name="Smooth",
        spans_full_width=True,
        variants=(
            FilterVariant(
                "soft",
                "Soft",
                Grade(adjustments={"contrast": -18, "clarity": -24, "brightness": 6}),
            ),
            FilterVariant(
                "silk",
                "Silk",
                Grade(adjustments={"contrast": -10, "clarity": -34, "highlights": 10, "saturation": -6}),
            ),
            FilterVariant(
                "haze",
                "Haze",
                Grade(adjustments={"contrast": -22, "clarity": -16}, fade=0.14),
            ),
        ),
    ),
    FilterPreset(
        id="cold",
        name="Cold",
        spans_full_width=True,
        variants=(
            FilterVariant(
                "ice",
                "Ice",
                Grade(adjustments={"temperature": -30, "contrast": 10}, gain=(0.94, 1.0, 1.1)),
            ),
            FilterVariant(
                "steel",
                "Steel",
                Grade(
                    adjustments={"temperature": -22, "saturation": -18, "contrast": 14},
                    gain=(0.96, 1.0, 1.06),
                ),
            ),
            FilterVariant(
                "arctic",
                "Arctic",
                Grade(
                    adjustments={"temperature": -38, "brightness": 8, "whites": 14},
                    gain=(0.92, 1.01, 1.14),
                ),
            ),
        ),
    ),
    FilterPreset(
        id="warm",
        name="Warm",
        spans_full_width=True,
        variants=(
            FilterVariant(
                "amber",
                "Amber",
                Grade(adjustments={"temperature": 28, "saturation": 8}, gain=(1.1, 1.0, 0.9)),
            ),
            FilterVariant(
                "honey",
                "Honey",
                Grade(
                    adjustments={"temperature": 20, "brightness": 8, "highlights": 12},
                    gain=(1.08, 1.02, 0.92),
                ),
            ),
            FilterVariant(
                "dusk",
                "Dusk",
                Grade(
                    adjustments={"temperature": 18, "contrast": 16, "shadows": -10},
                    gain=(1.06, 0.98, 0.96),
                ),
            ),
        ),
    ),
    FilterPreset(
        id="legacy",
        name="Legacy",
        spans_full_width=True,
        variants=(
            FilterVariant(
                "sepia",
                "Sepia",
                Grade(
                    mono=1,
                    gain=(1.16, 1.0, 0.78),
                    offset=(0.05, 0.02, -0.02),
                    adjustments={"contrast": 10},
                ),
            ),
            FilterVariant(
                "antique",
                "Antique",
                Grade(mono=0.7, gain=(1.12, 1.02, 0.84), adjustments={"contrast": 6}, fade=0.12),
            ),
            FilterVariant(
                "noir",
                "Noir",
                Grade(mono=1, adjustments={"contrast": 46, "blacks": 26, "clarity": 14}),
            ),
        ),
    ),
)

_PRESETS_BY_ID = {preset.id: preset for preset in FILTER_PRESETS}


@dataclass(frozen=True)
class ResolvedFilter:
    preset: FilterPreset
    variant: FilterVariant


def resolve_filter(identifier: str | None) -> ResolvedFilter | None:
    """Look up ``preset`` or ``preset/variant``, returning None when unknown."""
    if not identifier:
        return None
    preset_id, _, variant_id = identifier.partition("/")
    preset = _PRESETS_BY_ID.get(preset_id)
    if preset is None:
        return None
    variant = next((entry for entry in preset.variants if entry.id == variant_id), None)
    return ResolvedFilter(preset, variant or preset.variants[0])


def filter_id(preset: FilterPreset, variant: FilterVariant) -> str:
    """The canonical identifier for a preset/variant pair."""
    return preset.id if variant.id == preset.variants[0].id else f"{preset.id}/{variant.id}"


def filter_label(identifier: str | None) -> str | None:
    """Human-readable name for the current selection, shown under the grid."""
    resolved = resolve_filter(identifier)
    if resolved is None:
        return None
    if len(resolved.preset.variants) > 1:
        return f"{resolved.preset.name} · {resolved.variant.name}"
    return resolved.preset.name


def all_filter_ids() -> list[str]:
    """Every selectable identifier, used to build the preview thumbnail grid."""
    return [filter_id(preset, variant) for preset in FILTER_PRESETS for variant in preset.variants]
