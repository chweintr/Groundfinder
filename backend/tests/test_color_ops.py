import numpy as np

from app.color_ops import lab_to_lch, rgb_to_lab, srgb_to_linear


def test_srgb_to_linear_identity_for_zero():
    assert srgb_to_linear(np.array([0.0])) == 0.0


def test_rgb_to_lab_white_point():
    white = np.ones((1, 1, 3), dtype=np.uint8) * 255
    lab = rgb_to_lab(white)
    L, a, b = lab[0, 0]
    assert np.isclose(L, 100.0, atol=0.5)
    assert np.isclose(a, 0.0, atol=0.5)
    assert np.isclose(b, 0.0, atol=0.5)


def test_lab_to_lch_round_trip_axes():
    sample = np.array([[[50.0, 20.0, 30.0]]], dtype=np.float32)
    lch = lab_to_lch(sample)
    assert np.isclose(lch[0, 0, 0], 50.0)
    assert np.isclose(lch[0, 0, 1], np.sqrt(20.0**2 + 30.0**2))
    assert 0.0 <= lch[0, 0, 2] < 360.0

