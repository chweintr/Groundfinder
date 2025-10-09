from __future__ import annotations

import os
from pathlib import Path

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .analysis import analyze_image, classify_temperature, compute_ground_suggestions, find_value_mode, store
from .color_ops import lab_to_lch, rgb_to_hex, rgb_to_lab
from .ground import detect_ground_cluster, ground_inside_forms_mask, ground_mask_from_cluster, summarize_ground
from .mask_ops import DEFAULT_VIEWS, generate_mask, render_views
from .palette import match_palette
from .schemas import (
    AnalysisResponse,
    ClusterCenter,
    ClusterSummary,
    ColorMatchRequest,
    ColorMatchResponse,
    ExportRequest,
    ExportResponse,
    GroundInsideRequest,
    GroundInsideResponse,
    MaskRequest,
    MaskResponse,
    ValueModeSummary,
)

app = FastAPI(title="GroundFinder API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze(file: UploadFile = File(...)) -> AnalysisResponse:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    data = await file.read()
    result = analyze_image(data)

    peak_bin, (lower_bin, upper_bin) = find_value_mode(result.value_histogram)
    temp_map = result.temperature_map
    temperature_counts = {
        "warm": int(np.count_nonzero(temp_map == 0)),
        "cool": int(np.count_nonzero(temp_map == 1)),
        "neutral": int(np.count_nonzero(temp_map == 2)),
    }
    detected_ground = detect_ground_cluster(result)

    total_pixels = result.analysis_array.shape[0] * result.analysis_array.shape[1]
    clusters = [
        ClusterSummary(
            index=cluster.index,
            pixelCount=int(cluster.pixel_count),
            percentage=float(cluster.pixel_count) / total_pixels if total_pixels else 0.0,
            center=ClusterCenter(lab=cluster.center_lab.tolist(), lch=cluster.center_lch.tolist()),
        )
        for cluster in result.clusters
    ]

    suggestions = compute_ground_suggestions(result)

    response = AnalysisResponse(
        analysisId=result.analysis_id,
        originalSize=(int(result.original_array.shape[0]), int(result.original_array.shape[1])),
        analysisSize=(int(result.analysis_array.shape[0]), int(result.analysis_array.shape[1])),
        downscaleRatio=float(result.downscale_ratio),
        valueHistogram=result.value_histogram.tolist(),
        hueHistogram=result.hue_histogram.tolist(),
        temperatureCounts=temperature_counts,
        clusters=clusters,
        valueMode=ValueModeSummary(peakBin=peak_bin, lowerBin=lower_bin, upperBin=upper_bin),
        detectedGroundIndex=detected_ground,
        temperatureDefaults={
            "warmSpan": 60.0,
            "neutralChroma": 8.0,
        },
        groundSuggestions=[
            {
                "valueStep": item["valueStep"],
                "valueLabel": item["valueLabel"],
                "coverage": item["coverage"],
                "color": {
                    "hex": item["averageHex"],
                    "rgb": [int(v) for v in item["averageRgb"].tolist()],
                    "lab": [float(x) for x in item["averageLab"].tolist()],
                    "lch": [float(x) for x in item["averageLch"].tolist()],
                    "temperature": item["temperature"],
                },
                "paletteMatches": [
                    {
                        "id": match["id"],
                        "name": match["name"],
                        "hex": match["hex"],
                        "lab": match["lab"],
                        "lch": match["lch"],
                        "rgb": match["rgb"],
                        "deltaE": match["deltaE"],
                        "recipe": match["recipe"],
                        "notes": match["notes"],
                    }
                    for match in item.get("paletteMatches", [])
                ],
            }
            for item in suggestions
        ],
    )
    return response


@app.post("/mask", response_model=MaskResponse)
async def mask(request: MaskRequest) -> MaskResponse:
    try:
        result = store.get(request.analysisId)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="analysis not found") from exc

    views = request.views or list(DEFAULT_VIEWS)

    ground_lab = np.array(request.groundLab, dtype=np.float32) if request.groundLab is not None else None

    mask = generate_mask(
        result,
        request.mode,
        value_range=request.valueRange,
        hue=request.hue,
        hue_tolerance=request.hueTolerance,
        cluster_rank_index=request.clusterRankIndex,
        temperature_category=request.temperatureCategory,
        ground_lab=ground_lab,
        ground_tolerance=request.groundTolerance,
        warm_span=request.warmSpan,
        neutral_chroma=request.neutralChroma,
    )

    payload = render_views(result, mask, views=views, upscale=request.upscale)

    return MaskResponse(analysisId=request.analysisId, mode=request.mode, payload=payload)


@app.post("/ground-inside", response_model=GroundInsideResponse)
async def ground_inside(request: GroundInsideRequest) -> GroundInsideResponse:
    try:
        result = store.get(request.analysisId)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="analysis not found") from exc

    if request.groundSource == "detected":
        detected = detect_ground_cluster(result)
        if detected is None:
            raise HTTPException(status_code=400, detail="No ground cluster detected")
        ground_mask = ground_mask_from_cluster(result, detected, tolerance=request.groundTolerance)
    elif request.groundSource == "cluster":
        if request.clusterRankIndex is None:
            raise HTTPException(status_code=400, detail="clusterRankIndex required")
        ground_mask = ground_mask_from_cluster(result, request.clusterRankIndex, tolerance=request.groundTolerance)
    elif request.groundSource == "lab":
        if request.groundLab is None:
            raise HTTPException(status_code=400, detail="groundLab required")
        ground_lab = np.array(request.groundLab, dtype=np.float32)
        ground_mask = generate_mask(
            result,
            mode="ground",
            ground_lab=ground_lab,
            ground_tolerance=request.groundTolerance,
        )
    else:
        raise HTTPException(status_code=400, detail="Unknown groundSource")

    inside_mask = ground_inside_forms_mask(result, ground_mask)
    views = render_views(result, inside_mask, views=["highlight"], upscale=True)
    metrics = summarize_ground(result, inside_mask)
    return GroundInsideResponse(
        analysisId=request.analysisId,
        highlight=views["highlight"],
        coverage=metrics["coverage"],
        pixels=int(metrics["pixels"]),
    )


@app.post("/export", response_model=ExportResponse)
async def export(request: ExportRequest) -> ExportResponse:
    try:
        result = store.get(request.analysisId)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="analysis not found") from exc

    ground_lab = np.array(request.groundLab, dtype=np.float32) if request.groundLab is not None else None

    mask = generate_mask(
        result,
        request.mode,
        value_range=request.valueRange,
        hue=request.hue,
        hue_tolerance=request.hueTolerance,
        cluster_rank_index=request.clusterRankIndex,
        temperature_category=request.temperatureCategory,
        ground_lab=ground_lab,
        ground_tolerance=request.groundTolerance,
        warm_span=request.warmSpan,
        neutral_chroma=request.neutralChroma,
    )

    payload = render_views(result, mask, views=DEFAULT_VIEWS, upscale=True)
    summary = {
        "mode": request.mode,
        "valueRange": request.valueRange,
        "hue": request.hue,
        "hueTolerance": request.hueTolerance,
        "clusterRankIndex": request.clusterRankIndex,
        "temperatureCategory": request.temperatureCategory,
        "groundTolerance": request.groundTolerance,
        "warmSpan": request.warmSpan,
        "neutralChroma": request.neutralChroma,
        "imageSize": list(result.original_array.shape[:2]),
    }

    return ExportResponse(
        analysisId=request.analysisId,
        highlight=payload["highlight"],
        wash=payload["wash"],
        extract=payload["extract"],
        summary=summary,
    )


@app.post("/match-color", response_model=ColorMatchResponse)
async def match_color(request: ColorMatchRequest) -> ColorMatchResponse:
    """Match a single RGB color to the closest palette entries."""
    rgb_array = np.array(request.rgb, dtype=np.uint8).reshape(1, 1, 3)
    lab = rgb_to_lab(rgb_array).reshape(3)
    lch = lab_to_lch(lab.reshape(1, 1, 3)).reshape(3)
    hex_color = rgb_to_hex(rgb_array).item()

    temp_map = classify_temperature(lch.reshape(1, 1, 3), warm_span=60.0, neutral_chroma=8.0)
    temp_value = int(temp_map[0, 0])
    temp_label = {0: "warm", 1: "cool", 2: "neutral"}[temp_value]

    matches = match_palette(lab, top_n=3)

    return ColorMatchResponse(
        color={
            "hex": hex_color,
            "rgb": request.rgb,
            "lab": [float(x) for x in lab.tolist()],
            "lch": [float(x) for x in lch.tolist()],
            "temperature": temp_label,
        },
        paletteMatches=[
            {
                "id": match["id"],
                "name": match["name"],
                "hex": match["hex"],
                "lab": match["lab"],
                "lch": match["lch"],
                "rgb": match["rgb"],
                "deltaE": match["deltaE"],
                "recipe": match["recipe"],
                "notes": match["notes"],
            }
            for match in matches
        ],
    )


_static_dir = os.environ.get("FRONTEND_DIST")
if _static_dir:
    static_path = Path(_static_dir).resolve()
    index_file = static_path / "index.html"
    if static_path.exists() and index_file.exists():
        app.mount("/assets", StaticFiles(directory=static_path / "assets"), name="assets")

        @app.get("/", include_in_schema=False)
        async def serve_index() -> FileResponse:
            return FileResponse(index_file)

        @app.get("/{spa_path:path}", include_in_schema=False)
        async def serve_spa(spa_path: str) -> FileResponse:
            candidate = (static_path / spa_path).resolve()
            if candidate.is_file() and candidate.is_relative_to(static_path):
                return FileResponse(candidate)
            return FileResponse(index_file)
