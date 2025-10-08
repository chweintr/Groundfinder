"""Image analysis routines for GroundFinder."""
from __future__ import annotations

import io
import uuid
from dataclasses import dataclass
from typing import Dict, List, Tuple

import cv2
import numpy as np
from PIL import Image
from sklearn.cluster import KMeans

from .color_ops import lab_to_lch, lab_to_rgb, rgb_to_hex, rgb_to_lab
from .palette import match_palette, value_step_label

MAX_ANALYSIS_EDGE = 1600
DEFAULT_K = 5


@dataclass
class ClusterInfo:
    index: int
    center_lab: np.ndarray
    center_lch: np.ndarray
    pixel_count: int

    @property
    def percentage(self) -> float:
        return float(self.pixel_count)


@dataclass
class AnalysisResult:
    analysis_id: str
    original_image: Image.Image
    original_array: np.ndarray
    analysis_array: np.ndarray
    lab_array: np.ndarray
    lch_array: np.ndarray
    value_histogram: np.ndarray
    hue_histogram: np.ndarray
    temperature_map: np.ndarray
    clusters: List[ClusterInfo]
    labels: np.ndarray
    downscale_ratio: float

    def serialize_clusters(self) -> List[Dict[str, float]]:
        total = sum(c.pixel_count for c in self.clusters)
        response: List[Dict[str, float]] = []
        for c in self.clusters:
            lab = c.center_lab
            lch = c.center_lch
            response.append(
                {
                    "index": c.index,
                    "pixelCount": int(c.pixel_count),
                    "percentage": float(c.pixel_count) / total if total else 0.0,
                    "center": {
                        "lab": lab.tolist(),
                        "lch": lch.tolist(),
                    },
                }
            )
        return response


class AnalysisStore:
    """Simple in-memory analysis cache."""

    def __init__(self) -> None:
        self._items: Dict[str, AnalysisResult] = {}

    def add(self, result: AnalysisResult) -> AnalysisResult:
        self._items[result.analysis_id] = result
        return result

    def get(self, analysis_id: str) -> AnalysisResult:
        if analysis_id not in self._items:
            raise KeyError(analysis_id)
        return self._items[analysis_id]

    def remove(self, analysis_id: str) -> None:
        self._items.pop(analysis_id, None)


store = AnalysisStore()


def load_image(file_bytes: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    return image


def pil_to_numpy(image: Image.Image) -> np.ndarray:
    return np.array(image)


def downsample_image(img: np.ndarray, max_edge: int = MAX_ANALYSIS_EDGE) -> Tuple[np.ndarray, float]:
    h, w = img.shape[:2]
    scale = 1.0
    if max(h, w) > max_edge:
        scale = max_edge / max(h, w)
        new_size = (int(w * scale), int(h * scale))
        resized = cv2.resize(img, new_size, interpolation=cv2.INTER_AREA)
        return resized, scale
    return img.copy(), scale


def compute_value_histogram(L: np.ndarray, bins: int = 256) -> np.ndarray:
    hist, _ = np.histogram(np.clip(L, 0, 100), bins=bins, range=(0, 100))
    return hist.astype(np.int64)


def compute_hue_histogram(H: np.ndarray, bins: int = 360) -> np.ndarray:
    hist, _ = np.histogram(H, bins=bins, range=(0, 360))
    return hist.astype(np.int64)


def classify_temperature(
    lch: np.ndarray,
    warm_span: float = 60.0,
    neutral_chroma: float = 8.0,
) -> np.ndarray:
    """Return temperature classes (0 warm, 1 cool, 2 neutral)."""
    H = lch[..., 2]
    C = lch[..., 1]

    warm_span = float(np.clip(warm_span, 0.0, 180.0))
    warm_upper = warm_span
    warm_lower = (360.0 - warm_span) % 360.0

    warm_mask = (H <= warm_upper) | (H >= warm_lower)
    neutral_mask = C < neutral_chroma

    result = np.full(H.shape, fill_value=1, dtype=np.uint8)
    result[warm_mask] = 0
    result[neutral_mask] = 2
    return result


def compute_temperature_map(
    lch: np.ndarray,
    warm_span: float = 60.0,
    neutral_chroma: float = 8.0,
) -> np.ndarray:
    """Classify pixels into warm (0), cool (1), or neutral (2)."""
    return classify_temperature(lch, warm_span=warm_span, neutral_chroma=neutral_chroma)


def find_value_mode(hist: np.ndarray) -> Tuple[int, Tuple[int, int]]:
    peak_idx = int(np.argmax(hist))
    lower = max(0, peak_idx - 2)
    upper = min(len(hist) - 1, peak_idx + 2)
    return peak_idx, (lower, upper)


def run_kmeans(lab: np.ndarray, k: int = DEFAULT_K, seed: int = 17) -> Tuple[np.ndarray, List[ClusterInfo]]:
    h, w, _ = lab.shape
    flat = lab.reshape(-1, 3)
    kmeans = KMeans(n_clusters=k, random_state=seed, n_init=4)
    labels = kmeans.fit_predict(flat)
    counts = np.bincount(labels, minlength=k)
    centers_lab = kmeans.cluster_centers_
    centers_lch = lab_to_lch(centers_lab.reshape(-1, 1, 3)).reshape(-1, 3)

    clusters = [
        ClusterInfo(index=i, center_lab=centers_lab[i], center_lch=centers_lch[i], pixel_count=int(counts[i]))
        for i in range(k)
    ]
    clusters.sort(key=lambda c: c.pixel_count, reverse=True)
    labels = labels.reshape(h, w)
    return labels, clusters


def analyze_image(file_bytes: bytes) -> AnalysisResult:
    pil_image = load_image(file_bytes)
    original_np = pil_to_numpy(pil_image)
    analysis_np, scale = downsample_image(original_np, MAX_ANALYSIS_EDGE)

    lab = rgb_to_lab(analysis_np)
    lch = lab_to_lch(lab)
    value_hist = compute_value_histogram(lab[..., 0])
    hue_hist = compute_hue_histogram(lch[..., 2])
    temperature = compute_temperature_map(lch)
    labels, clusters = run_kmeans(lab)

    analysis_id = str(uuid.uuid4())
    result = AnalysisResult(
        analysis_id=analysis_id,
        original_image=pil_image,
        original_array=original_np,
        analysis_array=analysis_np,
        lab_array=lab,
        lch_array=lch,
        value_histogram=value_hist,
        hue_histogram=hue_hist,
        temperature_map=temperature,
        clusters=clusters,
        labels=labels,
        downscale_ratio=scale,
    )
    store.add(result)
    return result


def upsample_mask(mask: np.ndarray, target_shape: Tuple[int, int]) -> np.ndarray:
    target_h, target_w = target_shape
    resized = cv2.resize(mask.astype(np.uint8), (target_w, target_h), interpolation=cv2.INTER_NEAREST)
    return resized


def _temperature_label(mean_lch: np.ndarray) -> str:
    chroma = mean_lch[1]
    hue = mean_lch[2]
    if chroma < 8.0:
        return "neutral"
    if (hue <= 60.0) or (hue >= 300.0):
        return "warm"
    if 60.0 < hue < 240.0:
        return "cool"
    return "warm"


def compute_ground_suggestions(result: AnalysisResult, top_n: int = 3) -> List[dict]:
    lab = result.lab_array.reshape(-1, 3)
    lch = result.lch_array.reshape(-1, 3)
    L = lab[:, 0]
    total = lab.shape[0]
    if total == 0:
        return []

    edges = np.linspace(0.0, 100.0, 10)
    suggestions: List[dict] = []

    for idx in range(len(edges) - 1):
        lower, upper = edges[idx], edges[idx + 1]
        if idx == len(edges) - 2:
            mask = (L >= lower) & (L <= upper)
        else:
            mask = (L >= lower) & (L < upper)
        count = int(np.count_nonzero(mask))
        if count == 0:
            continue
        coverage = count / total
        mean_lab = lab[mask].mean(axis=0)
        mean_lch = lch[mask].mean(axis=0)
        rgb = lab_to_rgb(mean_lab)
        suggestions.append(
            {
                "valueStep": idx + 1,
                "valueLabel": value_step_label(idx + 1),
                "coverage": coverage,
                "averageLab": mean_lab,
                "averageLch": mean_lch,
                "averageRgb": rgb,
                "averageHex": rgb_to_hex(rgb),
                "temperature": _temperature_label(mean_lch),
            }
        )

    suggestions.sort(key=lambda item: item["coverage"], reverse=True)
    top = suggestions[:top_n]

    for item in top:
        item["paletteMatches"] = match_palette(item["averageLab"], top_n=3)

    return top
