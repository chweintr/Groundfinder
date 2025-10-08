"""Mask generation and overlay helpers."""
from __future__ import annotations

import base64
import io
from typing import Dict, Iterable, Tuple

import cv2
import numpy as np
from PIL import Image

from .analysis import AnalysisResult, upsample_mask

# View modes
HIGHLIGHT = "highlight"
WASH = "wash"
EXTRACT = "extract"

DEFAULT_VIEWS = (HIGHLIGHT, WASH, EXTRACT)


def _encode_png(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def _apply_highlight_overlay(base: np.ndarray, mask: np.ndarray) -> Image.Image:
    overlay_color = np.array([255, 64, 64], dtype=np.uint8)
    mask_3c = np.repeat(mask[:, :, None], 3, axis=2)
    highlight = overlay_color[None, None, :]
    blended = base.copy()
    blended[mask_3c] = (0.6 * highlight + 0.4 * base[mask_3c]).astype(np.uint8)
    return Image.fromarray(blended)


def _apply_wash_overlay(base: np.ndarray, mask: np.ndarray) -> Image.Image:
    mask_3c = np.repeat(mask[:, :, None], 3, axis=2)
    washed = base.astype(np.float32)
    washed[~mask_3c] *= 0.15
    washed = np.clip(washed, 0, 255).astype(np.uint8)
    output = base.copy()
    output[~mask_3c] = washed[~mask_3c]
    return Image.fromarray(output)


def _apply_extract_overlay(base: np.ndarray, mask: np.ndarray) -> Image.Image:
    h, w = mask.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[..., :3] = base
    rgba[..., 3] = mask.astype(np.uint8) * 255
    return Image.fromarray(rgba)


def _mask_from_value(l_channel: np.ndarray, lower_bin: int, upper_bin: int) -> np.ndarray:
    scaled = np.clip(l_channel, 0, 100)
    bins = np.clip(np.round(scaled / 100.0 * 255).astype(np.int32), 0, 255)
    return (bins >= lower_bin) & (bins <= upper_bin)


def _mask_from_hue(h_channel: np.ndarray, base_hue: float, tolerance: float) -> np.ndarray:
    diff = np.abs((h_channel - base_hue + 180.0) % 360.0 - 180.0)
    return diff <= tolerance


def _mask_from_cluster(labels: np.ndarray, cluster_rank_index: int, ranked_clusters: Iterable[int]) -> np.ndarray:
    ranked = list(ranked_clusters)
    if cluster_rank_index < 0 or cluster_rank_index >= len(ranked):
        raise ValueError("cluster_rank_index out of range")
    target = ranked[cluster_rank_index]
    return labels == target


def _mask_from_temperature(temperature_map: np.ndarray, category: str) -> np.ndarray:
    mapping = {
        "warm": 0,
        "cool": 1,
        "neutral": 2,
    }
    if category not in mapping:
        raise ValueError(f"Unknown temperature category: {category}")
    return temperature_map == mapping[category]


def _mask_from_ground_lab(lab_array: np.ndarray, target_lab: np.ndarray, tolerance: float) -> np.ndarray:
    diff = np.linalg.norm(lab_array - target_lab[None, None, :], axis=-1)
    return diff <= tolerance


def generate_mask(
    result: AnalysisResult,
    mode: str,
    *,
    value_range: Tuple[int, int] | None = None,
    hue: float | None = None,
    hue_tolerance: float = 10.0,
    cluster_rank_index: int | None = None,
    temperature_category: str | None = None,
    ground_lab: np.ndarray | None = None,
    ground_tolerance: float = 7.5,
) -> np.ndarray:
    if mode == "value":
        if not value_range:
            raise ValueError("value_range required for value mask")
        lower_bin, upper_bin = value_range
        mask = _mask_from_value(result.lab_array[..., 0], lower_bin, upper_bin)
    elif mode == "hue":
        if hue is None:
            raise ValueError("hue required for hue mask")
        mask = _mask_from_hue(result.lch_array[..., 2], hue, hue_tolerance)
    elif mode == "cluster":
        if cluster_rank_index is None:
            raise ValueError("cluster_rank_index required for cluster mask")
        ranked_indices = [c.index for c in result.clusters]
        mask = _mask_from_cluster(result.labels, cluster_rank_index, ranked_indices)
    elif mode == "temperature":
        if not temperature_category:
            raise ValueError("temperature_category required")
        mask = _mask_from_temperature(result.temperature_map, temperature_category)
    elif mode == "ground":
        if ground_lab is None:
            raise ValueError("ground_lab required for ground mask")
        mask = _mask_from_ground_lab(result.lab_array, ground_lab, ground_tolerance)
    else:
        raise ValueError(f"Unknown mode: {mode}")

    return mask.astype(bool)


def render_views(
    result: AnalysisResult,
    mask: np.ndarray,
    *,
    views: Iterable[str] = DEFAULT_VIEWS,
    upscale: bool = True,
) -> Dict[str, str]:
    analysis_mask = mask
    output: Dict[str, str] = {}

    if upscale and result.downscale_ratio != 1.0:
        target_shape = result.original_array.shape[:2]
        mask_full = upsample_mask(analysis_mask, target_shape)
        base = result.original_array
    else:
        mask_full = analysis_mask
        base = result.analysis_array

    mask_bool = mask_full.astype(bool)

    for view in views:
        if view == HIGHLIGHT:
            image = _apply_highlight_overlay(base, mask_bool)
        elif view == WASH:
            image = _apply_wash_overlay(base, mask_bool)
        elif view == EXTRACT:
            image = _apply_extract_overlay(base, mask_bool)
        else:
            raise ValueError(f"Unknown view: {view}")
        output[view] = _encode_png(image)

    return output


