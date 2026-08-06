"""Schema for the editor document the sidebar tools operate on.

The frontend owns pointer gestures only; every value it produces lands here and
all interpretation of those values happens in this package.
"""

from __future__ import annotations

import json
from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field

ADJUSTMENT_NAMES = (
    "brightness",
    "contrast",
    "saturation",
    "gamma",
    "clarity",
    "shadows",
    "highlights",
    "exposure",
    "blacks",
    "whites",
    "temperature",
    "sharpness",
)

Slider = Annotated[float, Field(ge=-100, le=100)]


class Adjustments(BaseModel):
    """The twelve Adjust-panel sliders, each neutral at zero."""

    model_config = ConfigDict(extra="forbid")

    brightness: Slider = 0
    contrast: Slider = 0
    saturation: Slider = 0
    gamma: Slider = 0
    clarity: Slider = 0
    shadows: Slider = 0
    highlights: Slider = 0
    exposure: Slider = 0
    blacks: Slider = 0
    whites: Slider = 0
    temperature: Slider = 0
    sharpness: Slider = 0

    def is_neutral(self) -> bool:
        return all(getattr(self, name) == 0 for name in ADJUSTMENT_NAMES)


class CropRect(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x: float = 0
    y: float = 0
    width: float = Field(gt=0)
    height: float = Field(gt=0)


class FilterSelection(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    preset_id: str | None = Field(default=None, alias="id")
    intensity: Annotated[float, Field(ge=0, le=100)] = 50


class FocusSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["radial", "mirrored", "linear", "gaussian"] = "radial"
    intensity: Annotated[float, Field(ge=0, le=100)] = 15
    x: float = 0
    y: float = 0
    radius: Annotated[float, Field(gt=0)] = 100
    angle: float = 0


class TextLayer(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    kind: Literal["text"]
    id: str
    x: float = 0
    y: float = 0
    width: Annotated[float, Field(gt=0)] = 400
    rotation: float = 0
    scale_x: float = Field(default=1, alias="scaleX")
    scale_y: float = Field(default=1, alias="scaleY")
    text: str = ""
    font_family: str = Field(default="display", alias="fontFamily")
    font_size: Annotated[float, Field(gt=0)] = Field(default=48, alias="fontSize")
    fill: str = "#ffffff"
    background: str = "transparent"
    align: Literal["left", "center", "right", "justify"] = "center"
    line_height: Annotated[float, Field(gt=0)] = Field(default=1.0, alias="lineHeight")


class TextDesignLayer(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    kind: Literal["textDesign"]
    id: str
    x: float = 0
    y: float = 0
    width: Annotated[float, Field(gt=0)] = 400
    rotation: float = 0
    scale_x: float = Field(default=1, alias="scaleX")
    scale_y: float = Field(default=1, alias="scaleY")
    template: str = "ribbon"
    variant: int = 0
    lines: list[str] = Field(default_factory=list)
    color: str = "#ffffff"
    inverted: bool = False


class BrushStrokeLayer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["stroke"]
    id: str
    #: Flattened x, y pairs in oriented-image pixels.
    points: list[float] = Field(default_factory=list)
    color: str = "#e02020"
    size: Annotated[float, Field(gt=0)] = 40
    hardness: Annotated[float, Field(ge=0, le=100)] = 50


Layer = Annotated[
    Union[TextLayer, TextDesignLayer, BrushStrokeLayer],
    Field(discriminator="kind"),
]


class EditDocument(BaseModel):
    """Everything the sidebar can change about one image."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    crop: CropRect | None = None
    #: Fine rotation in degrees, within the -45..45 range the slider exposes.
    rotation: Annotated[float, Field(ge=-45, le=45)] = 0
    #: Whole 90 degree turns applied before the fine rotation.
    quarter_turns: Annotated[int, Field(ge=0, le=3)] = Field(default=0, alias="quarterTurns")
    flip_x: bool = Field(default=False, alias="flipX")
    flip_y: bool = Field(default=False, alias="flipY")
    keep_resolution: bool = Field(default=False, alias="keepResolution")
    adjustments: Adjustments = Field(default_factory=Adjustments, alias="adjust")
    filter: FilterSelection = Field(default_factory=FilterSelection)
    focus: FocusSettings | None = None
    layers: list[Layer] = Field(default_factory=list)

    @classmethod
    def from_json(cls, raw: str) -> "EditDocument":
        return cls.model_validate(json.loads(raw))
