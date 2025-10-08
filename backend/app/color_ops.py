"""Color space conversion helpers."""
from __future__ import annotations

import numpy as np


def srgb_to_linear(x: np.ndarray) -> np.ndarray:
    """Convert sRGB values (0-1) to linear light."""
    a = 0.055
    return np.where(x <= 0.04045, x / 12.92, ((x + a) / (1 + a)) ** 2.4)


def rgb_to_lab(img_uint8: np.ndarray) -> np.ndarray:
    """Convert an HxWx3 uint8 sRGB image into CIELAB."""
    x = srgb_to_linear(img_uint8.astype(np.float32) / 255.0)
    m = np.array(
        [
            [0.4124564, 0.3575761, 0.1804375],
            [0.2126729, 0.7151522, 0.0721750],
            [0.0193339, 0.1191920, 0.9503041],
        ],
        dtype=np.float32,
    )
    xyz = x @ m.T
    wn = np.array([0.95047, 1.0, 1.08883], dtype=np.float32)
    ratio = xyz / wn
    epsilon = 0.008856
    kappa = 7.787
    f = np.where(ratio > epsilon, np.cbrt(ratio), kappa * ratio + 16 / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], axis=-1)


def lab_to_lch(lab: np.ndarray) -> np.ndarray:
    """Convert Lab to polar LCHab coordinates."""
    L = lab[..., 0]
    a = lab[..., 1]
    b = lab[..., 2]
    C = np.sqrt(a * a + b * b)
    H = (np.degrees(np.arctan2(b, a)) + 360.0) % 360.0
    return np.stack([L, C, H], axis=-1)


def lab_to_relative_value(L: np.ndarray) -> np.ndarray:
    """Normalize Lab L* channel to 0-100 scale."""
    return np.clip(L, 0, 100)


def linear_to_srgb(x: np.ndarray) -> np.ndarray:
    return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(np.clip(x, 0, None), 1 / 2.4) - 0.055)


def lab_to_rgb(lab: np.ndarray) -> np.ndarray:
    """Convert Lab values to 0-255 sRGB."""
    lab = np.asarray(lab, dtype=np.float32)
    L = lab[..., 0]
    a = lab[..., 1]
    b = lab[..., 2]

    fy = (L + 16.0) / 116.0
    fx = a / 500.0 + fy
    fz = fy - b / 200.0

    def finv(t: np.ndarray) -> np.ndarray:
        return np.where(t ** 3 > 0.008856, t ** 3, (t - 16.0 / 116.0) / 7.787)

    X = 0.95047 * finv(fx)
    Y = 1.0 * finv(fy)
    Z = 1.08883 * finv(fz)

    M = np.array(
        [
            [3.2404542, -1.5371385, -0.4985314],
            [-0.9692660, 1.8760108, 0.0415560],
            [0.0556434, -0.2040259, 1.0572252],
        ],
        dtype=np.float32,
    )

    rgb_linear = np.stack([X, Y, Z], axis=-1) @ M.T
    rgb = linear_to_srgb(rgb_linear)
    rgb_uint8 = np.clip(np.round(rgb * 255.0), 0, 255).astype(np.uint8)
    return rgb_uint8


def rgb_to_hex(rgb: np.ndarray) -> str:
    rgb = np.asarray(rgb).astype(np.uint8)
    if rgb.ndim > 1:
        rgb = rgb.reshape(-1)[:3]
    return "#" + "".join(f"{int(v):02X}" for v in rgb)


__all__ = [
    "srgb_to_linear",
    "rgb_to_lab",
    "lab_to_lch",
    "lab_to_relative_value",
    "lab_to_rgb",
    "linear_to_srgb",
    "rgb_to_hex",
]
