"""Ground color utilities."""
from __future__ import annotations

from typing import Dict, Optional

import cv2
import numpy as np

from .analysis import AnalysisResult
from .mask_ops import generate_mask

GROUND_VALUE_RANGE = (35.0, 65.0)
GROUND_CHROMA_MAX = 8.0


def detect_ground_cluster(result: AnalysisResult) -> Optional[int]:
    candidate = None
    candidate_pixels = -1
    for ranked_idx, cluster in enumerate(result.clusters):
        L = cluster.center_lch[0]
        C = cluster.center_lch[1]
        if GROUND_VALUE_RANGE[0] <= L <= GROUND_VALUE_RANGE[1] and C < GROUND_CHROMA_MAX:
            if cluster.pixel_count > candidate_pixels:
                candidate = ranked_idx
                candidate_pixels = cluster.pixel_count
    return candidate


def ground_mask_from_cluster(result: AnalysisResult, ranked_index: int, tolerance: float = 6.0) -> np.ndarray:
    cluster = result.clusters[ranked_index]
    target_lab = cluster.center_lab
    mask = generate_mask(
        result,
        mode="ground",
        ground_lab=target_lab,
        ground_tolerance=tolerance,
    )
    return mask


def ground_inside_forms_mask(result: AnalysisResult, ground_mask: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(result.analysis_array, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 60, 150)
    kernel = np.ones((3, 3), np.uint8)
    edges = cv2.dilate(edges, kernel, iterations=1)
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel, iterations=2)

    inv_edges = cv2.bitwise_not(edges)
    h, w = inv_edges.shape
    flood = inv_edges.copy()
    cv2.floodFill(flood, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 0)
    objects = cv2.bitwise_not(flood)
    objects = cv2.morphologyEx(objects, cv2.MORPH_OPEN, kernel, iterations=1)

    objects_bool = objects > 0
    ground_inside = ground_mask & objects_bool

    edge_band = cv2.dilate(edges, kernel, iterations=1) > 0
    frayed = ground_inside & edge_band

    combined = ground_inside.copy()
    combined[frayed] = True
    return combined


def summarize_ground(result: AnalysisResult, ground_mask: np.ndarray) -> Dict[str, float]:
    total_pixels = ground_mask.size
    ground_pixels = int(np.count_nonzero(ground_mask))
    return {
        "pixels": ground_pixels,
        "coverage": ground_pixels / total_pixels if total_pixels else 0.0,
    }


