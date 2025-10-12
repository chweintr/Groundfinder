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
        "recipe": "Burnt Umber + Sap Green + Titanium White (4:1:2)",
        "notes": "Warm olive neutral that keeps lights clean while anchoring cool passages.",
    },
    {
        "id": "raw-sienna-float",
        "name": "Warm Sienna Float",
        "hex": "#A98B63",
        "recipe": "Burnt Sienna + Burnt Umber + Titanium White (5:1:3)",
        "notes": "Classic warm ground for luminous yellows and flesh notes.",
    },
    {
        "id": "cool-slate",
        "name": "Cool Slate",
        "hex": "#6F7684",
        "recipe": "Ultramarine Blue + Burnt Umber + Titanium White (2:1:4)",
        "notes": "Cool gray that lets warms flare; great for metallic or nocturne palettes.",
    },
    {
        "id": "warm-neutral-gray",
        "name": "Warm Neutral Gray",
        "hex": "#8B8074",
        "recipe": "Burnt Sienna + Burnt Umber + Titanium White (2:2:3)",
        "notes": "Balanced warm gray that harmonises both foliage and skin tones.",
    },
    {
        "id": "cold-porcelain",
        "name": "Cold Porcelain",
        "hex": "#C6C3BD",
        "recipe": "Titanium White + Ultramarine Blue + Burnt Umber (10:1:1)",
        "notes": "Light neutral for high-key paintings with controlled cools.",
    },
    {
        "id": "umber-shadow",
        "name": "Deep Umber Shadow",
        "hex": "#4E453B",
        "recipe": "Burnt Umber + Dioxazine Purple (5:1)",
        "notes": "Low-key ground to support strong highlights and atmospheric lights.",
    },
    {
        "id": "terra-rosa-veil",
        "name": "Terra Rosa Veil",
        "hex": "#B57763",
        "recipe": "Cadmium Red Light + Burnt Umber + Titanium White (3:1:2)",
        "notes": "Rosy warm base beloved in figurative work for subtle flesh vibration.",
    },
    {
        "id": "sage-underpaint",
        "name": "Sage Underpaint",
        "hex": "#7F8F77",
        "recipe": "Sap Green + Burnt Umber + Titanium White (3:2:3)",
        "notes": "Herbal cool that keeps foliage lively without overpowering warms.",
    },
    {
        "id": "cool-mid-gray",
        "name": "Cool Mid Gray",
        "hex": "#6B6D70",
        "recipe": "Ultramarine Blue + Burnt Umber + Titanium White (2:2:4)",
        "notes": "Cool mid-value neutral for atmospheric perspective and shadow foundations.",
    },
    {
        "id": "warm-mid-gray",
        "name": "Warm Mid Gray",
        "hex": "#706B65",
        "recipe": "Burnt Umber + Burnt Sienna + Titanium White (3:1:3)",
        "notes": "Warm mid-value base that harmonizes earth tones and architectural subjects.",
    },
    {
        "id": "neutral-light-gray",
        "name": "Neutral Light Gray",
        "hex": "#A8A8A8",
        "recipe": "Titanium White + Ultramarine Blue + Burnt Sienna (10:1:1)",
        "notes": "True neutral light gray for high-key works and subtle value control.",
    },
    {
        "id": "neutral-mid-gray",
        "name": "Neutral Mid Gray",
        "hex": "#808080",
        "recipe": "Titanium White + Phthalo Blue + Burnt Sienna (5:1:1)",
        "notes": "Perfect middle gray for tonal studies and establishing value relationships.",
    },
    {
        "id": "neutral-dark-gray",
        "name": "Neutral Dark Gray",
        "hex": "#505050",
        "recipe": "Burnt Umber + Ultramarine Blue (3:1)",
        "notes": "Dark neutral foundation for low-key compositions and dramatic lighting.",
    },
    {
        "id": "ochre-stone",
        "name": "Ochre Stone",
        "hex": "#9C8762",
        "recipe": "Cadmium Yellow Medium + Burnt Umber + Titanium White (3:1:2)",
        "notes": "Earthy golden base perfect for landscapes and warm-light interiors.",
    },
    {
        "id": "rose-gray",
        "name": "Rose Gray",
        "hex": "#9B8A87",
        "recipe": "Quinacridone Magenta + Ultramarine Blue + Titanium White (2:1:5)",
        "notes": "Subtle rose-tinted neutral for figurative work and soft atmospheric effects.",
    },
    {
        "id": "blue-gray-light",
        "name": "Blue Gray Light",
        "hex": "#9BA5AE",
        "recipe": "Sevres Blue + Burnt Umber + Titanium White (2:1:5)",
        "notes": "Cool blue-gray for sky studies and creating atmospheric depth.",
    },
    {
        "id": "warm-pink-ground",
        "name": "Warm Pink Ground",
        "hex": "#D4A5A5",
        "recipe": "Dianthus Pink + Titanium White (1:3)",
        "notes": "Delicate warm ground for portraits and soft atmospheric effects.",
    },
    {
        "id": "golden-ochre",
        "name": "Golden Ochre",
        "hex": "#C2A565",
        "recipe": "Cadmium Yellow Medium + Burnt Sienna + Titanium White (4:1:2)",
        "notes": "Rich golden ground for warm sunlit scenes and classical techniques.",
    },
    {
        "id": "verde-tone",
        "name": "Verde Tone",
        "hex": "#6B7B6A",
        "recipe": "Phthalo Green + Burnt Umber + Titanium White (1:3:3)",
        "notes": "Muted green base for landscape work and natural subjects.",
    },
    {
        "id": "crimson-shadow",
        "name": "Crimson Shadow",
        "hex": "#6B4A4A",
        "recipe": "Alizarin Crimson + Burnt Umber (2:3)",
        "notes": "Deep warm ground for dramatic lighting and rich shadows.",
    },
    {
        "id": "orange-clay",
        "name": "Orange Clay",
        "hex": "#B88560",
        "recipe": "Cadmium Orange + Burnt Umber + Titanium White (3:1:2)",
        "notes": "Terracotta-inspired ground for warm earth tones and Mediterranean light.",
    },
    {
        "id": "violet-gray",
        "name": "Violet Gray",
        "hex": "#8B7B8A",
        "recipe": "Dioxazine Purple + Burnt Umber + Titanium White (1:2:4)",
        "notes": "Subtle violet-tinted neutral for evening scenes and cool shadows.",
    },
    {
        "id": "phthalo-silver",
        "name": "Phthalo Silver",
        "hex": "#7A8B8B",
        "recipe": "Phthalo Blue + Burnt Sienna + Titanium White (1:1:5)",
        "notes": "Silvery cool ground for water scenes and overcast atmospheres.",
    },
    {
        "id": "cadmium-neutral",
        "name": "Cadmium Neutral",
        "hex": "#A89680",
        "recipe": "Cadmium Yellow Medium + Quinacridone Magenta + Titanium White (3:1:3)",
        "notes": "Warm neutral without umber, for clean modern grounds.",
    },
    {
        "id": "blue-green-gray",
        "name": "Blue Green Gray",
        "hex": "#728A85",
        "recipe": "Phthalo Green + Alizarin Crimson + Titanium White (2:1:4)",
        "notes": "Complex cool neutral using complementary mixing instead of earth tones.",
    },
    {
        "id": "violet-warm-gray",
        "name": "Violet Warm Gray",
        "hex": "#948885",
        "recipe": "Quinacridone Magenta + Sap Green + Titanium White (2:1:4)",
        "notes": "Subtle warm gray using complementary colors for optical vibrancy.",
    },
    {
        "id": "lemon-gray",
        "name": "Lemon Gray",
        "hex": "#B5B895",
        "recipe": "Cadmium Lemon + Dioxazine Purple + Titanium White (3:1:4)",
        "notes": "Cool yellow-gray for soft natural light and botanical subjects.",
    },
    {
        "id": "orange-complement-gray",
        "name": "Orange Complement Gray",
        "hex": "#9A8878",
        "recipe": "Cadmium Orange + Ultramarine Blue + Titanium White (2:1:3)",
        "notes": "Rich neutral from complementary mixing, warmer alternative to umber grays.",
    },
    {
        "id": "magenta-sky",
        "name": "Magenta Sky",
        "hex": "#AFA5B0",
        "recipe": "Quinacridone Magenta + Phthalo Green + Titanium White (1:1:6)",
        "notes": "Delicate lavender-gray for atmospheric skies and twilight effects.",
    },
    {
        "id": "sevres-pearl",
        "name": "Sevres Pearl",
        "hex": "#B8C5CC",
        "recipe": "Sevres Blue + Cadmium Orange + Titanium White (2:1:7)",
        "notes": "Luminous pearl gray with subtle warmth, excellent for high-key works.",
    },
    {
        "id": "red-gray-neutral",
        "name": "Red Gray Neutral",
        "hex": "#8A7A78",
        "recipe": "Cadmium Red + Phthalo Green + Titanium White (2:1:4)",
        "notes": "Sophisticated neutral using pure pigment complements instead of earth tones.",
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
    """
    Calculate perceptually weighted color difference.
    Uses a weighted Euclidean distance that gives more importance to lightness
    differences, which is more perceptually accurate for ground colors.
    """
    dL = lab1[0] - lab2[0]
    da = lab1[1] - lab2[1]
    db = lab1[2] - lab2[2]
    
    # Weight lightness more heavily (1.5x) as it's more perceptually important for grounds
    # This helps avoid matching very different lightness values
    return float(np.sqrt((1.5 * dL) ** 2 + da ** 2 + db ** 2))


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
