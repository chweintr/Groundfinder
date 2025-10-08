"""Pydantic schemas for API serialization."""
from __future__ import annotations

from typing import Dict, List, Literal, Optional, Tuple

from pydantic import BaseModel, Field


class ClusterCenter(BaseModel):
    lab: List[float]
    lch: List[float]


class ClusterSummary(BaseModel):
    index: int
    pixelCount: int
    percentage: float
    center: ClusterCenter


class ValueModeSummary(BaseModel):
    peakBin: int
    lowerBin: int
    upperBin: int


class ColorSwatch(BaseModel):
    hex: str
    rgb: List[int]
    lab: List[float]
    lch: List[float]
    temperature: str


class PaletteMatchSummary(BaseModel):
    id: str
    name: str
    hex: str
    lab: List[float]
    lch: List[float]
    rgb: List[int]
    deltaE: float
    recipe: str
    notes: str


class GroundSuggestion(BaseModel):
    valueStep: int
    valueLabel: str
    coverage: float
    color: ColorSwatch
    paletteMatches: List[PaletteMatchSummary]


class AnalysisResponse(BaseModel):
    analysisId: str
    originalSize: Tuple[int, int]
    analysisSize: Tuple[int, int]
    downscaleRatio: float
    valueHistogram: List[int]
    hueHistogram: List[int]
    temperatureCounts: Dict[str, int]
    clusters: List[ClusterSummary]
    valueMode: ValueModeSummary
    detectedGroundIndex: Optional[int]
    temperatureDefaults: Dict[str, float]
    groundSuggestions: List[GroundSuggestion]


class MaskRequest(BaseModel):
    analysisId: str
    mode: Literal["value", "hue", "cluster", "temperature", "ground"]
    valueRange: Optional[Tuple[int, int]] = None
    hue: Optional[float] = None
    hueTolerance: float = 12.0
    clusterRankIndex: Optional[int] = None
    temperatureCategory: Optional[Literal["warm", "cool", "neutral"]] = None
    groundLab: Optional[List[float]] = Field(default=None, description="Lab center for ground masking")
    groundTolerance: float = 7.5
    warmSpan: float = 60.0
    neutralChroma: float = 8.0
    views: Optional[List[Literal["highlight", "wash", "extract"]]] = None
    upscale: bool = True


class MaskResponse(BaseModel):
    analysisId: str
    mode: str
    payload: Dict[str, str]


class GroundInsideRequest(BaseModel):
    analysisId: str
    groundSource: Literal["detected", "cluster", "lab"] = "detected"
    clusterRankIndex: Optional[int] = None
    groundLab: Optional[List[float]] = None
    groundTolerance: float = 6.0


class GroundInsideResponse(BaseModel):
    analysisId: str
    highlight: str
    coverage: float
    pixels: int


class ExportRequest(BaseModel):
    analysisId: str
    mode: Literal["value", "hue", "cluster", "temperature", "ground"]
    valueRange: Optional[Tuple[int, int]] = None
    hue: Optional[float] = None
    hueTolerance: float = 12.0
    clusterRankIndex: Optional[int] = None
    temperatureCategory: Optional[Literal["warm", "cool", "neutral"]] = None
    groundLab: Optional[List[float]] = None
    groundTolerance: float = 7.5


class ExportResponse(BaseModel):
    analysisId: str
    highlight: str
    wash: str
    extract: str
    summary: Dict[str, object]
