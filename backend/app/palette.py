"""Ground color palette and matching utilities."""
from __future__ import annotations

from dataclasses import dataclass
from typing import List

import numpy as np

from .color_ops import lab_to_lch, lab_to_rgb, rgb_to_hex, rgb_to_lab


@dataclass(frozen=True)
class PaletteEntry:
    id: str
    name: str
    hex: str
    recipe: str
    notes: str
    lab: np.ndarray
    lch: np.ndarray


def _hex_to_rgb(hex_code: str) -> np.ndarray:
    hex_code = hex_code.lstrip("#")
    if len(hex_code) != 6:
        raise ValueError(f"Unexpected hex color: {hex_code}")
    r = int(hex_code[0:2], 16)
    g = int(hex_code[2:4], 16)
    b = int(hex_code[4:6], 16)
    return np.array([r, g, b], dtype=np.uint8)


_BASE_ENTRIES = [
    {
        "id": "olive-umber-wash",
        "name": "Olive Umber Wash",
        "hex": "#7B7A64",
        "recipe": "Raw Umber + Viridian + Titanium White (4:1:2)",
        "notes": "Warm olive neutral that keeps lights clean while anchoring cool passages.",
    },
    {
        "id": "raw-sienna-float",
        "name": "Raw Sienna Float",
        "hex": "#A98B63",
        "recipe": "Raw Sienna + Burnt Umber + White (5:1:3)",
        "notes": "Classic warm ground for luminous yellows and flesh notes.",
    },
    {
        "id": "cool-slate",
        "name": "Cool Slate",
        "hex": "#6F7684",
        "recipe": "Payne's Gray + Ultramarine + White (3:1:4)",
        "notes": "Cool gray that lets warms flare; great for metallic or nocturne palettes.",
    },
    {
        "id": "warm-neutral-gray",
        "name": "Warm Neutral Gray",
        "hex": "#8B8074",
        "recipe": "Burnt Sienna + Raw Umber + White (2:2:3)",
        "notes": "Balanced warm gray that harmonises both foliage and skin tones.",
    },
    {
        "id": "cold-porcelain",
        "name": "Cold Porcelain",
        "hex": "#C6C3BD",
        "recipe": "Titanium White + Payne's Gray + Raw Umber (6:1:1)",
        "notes": "Light neutral for high-key paintings with controlled cools.",
    },
    {
        "id": "umber-shadow",
        "name": "Deep Umber Shadow",
        "hex": "#4E453B",
        "recipe": "Raw Umber + Ivory Black (4:1)",
        "notes": "Low-key ground to support strong highlights and atmospheric lights.",
    },
    {
        "id": "terra-rosa-veil",
        "name": "Terra Rosa Veil",
        "hex": "#B57763",
        "recipe": "Terra Rosa + Raw Umber + White (4:1:2)",
        "notes": "Rosy warm base beloved in figurative work for subtle flesh vibration.",
    },
    {
        "id": "sage-underpaint",
        "name": "Sage Underpaint",
        "hex": "#7F8F77",
        "recipe": "Chromium Oxide Green + Raw Umber + White (3:2:3)",
        "notes": "Herbal cool that keeps foliage lively without overpowering warms.",
    },
]


def _build_entries() -> List[PaletteEntry]:
    entries: List[PaletteEntry] = []
    for base in _BASE_ENTRIES:
        rgb = _hex_to_rgb(base["hex"])
        lab = rgb_to_lab(rgb.reshape(1, 1, 3)).reshape(3)
        lch = lab_to_lch(lab.reshape(1, 1, 3)).reshape(3)
        entries.append(
            PaletteEntry(
                id=base["id"],
                name=base["name"],
                hex=base["hex"],
                recipe=base["recipe"],
                notes=base["notes"],
                lab=lab,
                lch=lch,
            )
        )
    return entries


PALETTE: List[PaletteEntry] = _build_entries()


def delta_e(lab1: np.ndarray, lab2: np.ndarray) -> float:
    return float(np.linalg.norm(lab1 - lab2))


def match_palette(lab_color: np.ndarray, top_n: int = 3) -> List[dict]:
    candidates = []
    for entry in PALETTE:
        diff = delta_e(lab_color, entry.lab)
        candidates.append(
            {
                "id": entry.id,
                "name": entry.name,
                "hex": entry.hex,
                "recipe": entry.recipe,
                "notes": entry.notes,
                "deltaE": diff,
                "lab": entry.lab.tolist(),
                "lch": entry.lch.tolist(),
                "rgb": lab_to_rgb(entry.lab).tolist(),
            }
        )
    candidates.sort(key=lambda item: item["deltaE"])
    return candidates[:top_n]


def value_step_label(step: int) -> str:
    mapping = {
        1: "Deep shadow",
        2: "Shadow",
        3: "Low mid",
        4: "Mid",
        5: "High mid",
        6: "Light",
        7: "High light",
        8: "Very light",
        9: "Highlight",
    }
    return mapping.get(step, f"Step {step}")


__all__ = ["PALETTE", "match_palette", "value_step_label"]
