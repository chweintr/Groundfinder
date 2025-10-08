import numpy as np
from PIL import Image

from app.analysis import AnalysisResult
from app.mask_ops import generate_mask


def make_dummy_result() -> AnalysisResult:
    original = np.zeros((2, 2, 3), dtype=np.uint8)
    analysis = np.zeros((2, 2, 3), dtype=np.uint8)
    lab = np.zeros((2, 2, 3), dtype=np.float32)
    lch = np.zeros((2, 2, 3), dtype=np.float32)
    value_hist = np.zeros(256, dtype=np.int64)
    hue_hist = np.zeros(360, dtype=np.int64)
    temperature_map = np.zeros((2, 2), dtype=np.uint8)
    labels = np.array([[0, 1], [0, 1]], dtype=np.int32)

    class DummyCluster:
        def __init__(self, index: int, lab_center, lch_center, pixels: int):
            self.index = index
            self.center_lab = np.array(lab_center, dtype=np.float32)
            self.center_lch = np.array(lch_center, dtype=np.float32)
            self.pixel_count = pixels

    clusters = [
        DummyCluster(0, [50.0, 0.0, 0.0], [50.0, 2.0, 10.0], 2),
        DummyCluster(1, [70.0, 10.0, -5.0], [70.0, 3.0, 190.0], 2),
    ]

    return AnalysisResult(
        analysis_id="test",
        original_image=Image.fromarray(original),
        original_array=original,
        analysis_array=analysis,
        lab_array=lab,
        lch_array=lch,
        value_histogram=value_hist,
        hue_histogram=hue_hist,
        temperature_map=temperature_map,
        clusters=clusters,
        labels=labels,
        downscale_ratio=1.0,
    )


def test_cluster_mask_uses_ranked_order():
    result = make_dummy_result()
    mask = generate_mask(result, "cluster", cluster_rank_index=0)
    assert mask.shape == (2, 2)
    assert mask.dtype == bool
    assert mask.tolist() == [[True, False], [True, False]]


def test_ground_mask_lab_distance():
    result = make_dummy_result()
    result.lab_array[..., :] = np.array([50.0, 0.0, 0.0], dtype=np.float32)
    mask = generate_mask(result, "ground", ground_lab=np.array([50.0, 0.0, 0.0]), ground_tolerance=0.5)
    assert mask.all()

