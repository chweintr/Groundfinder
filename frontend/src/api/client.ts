import type {
  AnalysisData,
  ColorMatchResponse,
  ExportResponse,
  GroundInsideResponse,
  MaskMode,
  MaskResponse,
  ViewMode,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ??
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:8000");

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  return response.json() as Promise<T>;
}

export async function analyzeImage(file: File): Promise<AnalysisData> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE_URL}/analyze`, {
    method: "POST",
    body: form,
  });
  return handleResponse<AnalysisData>(response);
}

export interface MaskRequestPayload {
  analysisId: string;
  mode: MaskMode;
  valueRange?: [number, number];
  hue?: number;
  hueTolerance?: number;
  clusterRankIndex?: number;
  temperatureCategory?: "warm" | "cool" | "neutral";
  groundLab?: [number, number, number];
  groundTolerance?: number;
  views?: ViewMode[];
  upscale?: boolean;
  warmSpan?: number;
  neutralChroma?: number;
}

export async function requestMask(payload: MaskRequestPayload): Promise<MaskResponse> {
  const response = await fetch(`${API_BASE_URL}/mask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<MaskResponse>(response);
}

export interface GroundInsidePayload {
  analysisId: string;
  groundSource: "detected" | "cluster" | "lab";
  clusterRankIndex?: number;
  groundLab?: [number, number, number];
  groundTolerance?: number;
}

export async function requestGroundInside(payload: GroundInsidePayload): Promise<GroundInsideResponse> {
  const response = await fetch(`${API_BASE_URL}/ground-inside`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<GroundInsideResponse>(response);
}

export interface ExportPayload extends MaskRequestPayload {}

export async function requestExport(payload: ExportPayload): Promise<ExportResponse> {
  const response = await fetch(`${API_BASE_URL}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<ExportResponse>(response);
}

export function asDataUrl(base64: string, mime = "image/png"): string {
  return `data:${mime};base64,${base64}`;
}

import { ColorMixer } from '../services/color/color-mixer';
import { DEFAULT_PIGMENT_SET } from '../services/color/pigments';
import { Rgb } from '../services/color/space/rgb';
import type { RgbTuple } from '../services/color/space/rgb';
import { rgbToLab, rgbToLch } from '../utils/colorConversion';

// Initialize color mixer with pigment set
let colorMixer: ColorMixer | null = null;

function getColorMixer(): ColorMixer {
  if (!colorMixer) {
    console.log('Initializing color mixer with pigment set...');
    try {
      colorMixer = new ColorMixer();
      console.log('ColorMixer created, setting color set...');
      colorMixer.setColorSet(DEFAULT_PIGMENT_SET, '#F7F5EF'); // Paper white background
      console.log('Color mixer initialized successfully');
    } catch (error) {
      console.error('Failed to initialize color mixer:', error);
      throw error;
    }
  }
  return colorMixer;
}

export async function matchColor(rgb: number[]): Promise<ColorMatchResponse> {
  console.log('matchColor called with RGB:', rgb);
  try {
    const mixer = getColorMixer();
    const rgbTuple: RgbTuple = [rgb[0]!, rgb[1]!, rgb[2]!];
    console.log('Finding similar color for:', rgbTuple);
    
    // Find the best color mixture match
    const similarColor = mixer.findSimilarColor(rgbTuple);
    console.log('Similar color found:', similarColor);
    
    if (!similarColor) {
      throw new Error('No color match found');
    }

    const { colorMixture, similarity } = similarColor;
    const rgbColor = Rgb.fromTuple(colorMixture.layerRgb);
    console.log('Color mixture:', colorMixture, 'similarity:', similarity);
    
    const [r, g, b] = colorMixture.layerRgb;
    
    // Calculate LAB and LCH from the result RGB
    const lab = rgbToLab(r!, g!, b!);
    const lch = rgbToLch(r!, g!, b!);
    console.log('LAB:', lab, 'LCH:', lch);
    
    // Determine temperature from LCH
    const chroma = lch[1];
    const hueAngle = lch[2];
    let temperature = 'neutral';
    if (chroma > 8) {
      if ((hueAngle >= 0 && hueAngle <= 60) || hueAngle >= 300) {
        temperature = 'warm';
      } else if (hueAngle > 60 && hueAngle < 240) {
        temperature = 'cool';
      } else {
        temperature = 'warm';
      }
    }
    
    // Format the recipe including white tint if present
    const colorParts = colorMixture.parts
      .map(({ color, part }) => `${color.name} (${part})`)
      .join(' + ');
    
    const whitePart = colorMixture.white && colorMixture.whiteFraction[0] > 0
      ? ` + ${colorMixture.white.name} (${colorMixture.whiteFraction[0]})`
      : '';
    
    const recipe = colorMixture.parts.length === 1 && !whitePart
      ? colorMixture.parts[0]!.color.name
      : colorParts + whitePart;
    
    console.log('Final recipe:', recipe);

    return {
      color: {
        hex: rgbColor.toHex(),
        rgb: [r!, g!, b!],
        lab,
        lch,
        temperature,
      },
      paletteMatches: [
        {
          id: `mixture-${Date.now()}`,
          name: colorMixture.parts.length === 1 && !whitePart ? colorMixture.parts[0]!.color.name : 'Custom Mixture',
          hex: rgbColor.toHex(),
          lab,
          lch,
          rgb: [r!, g!, b!],
          deltaE: 100 - similarity,
          recipe,
          notes: `Match accuracy: ${similarity.toFixed(1)}%`,
        },
      ],
    };
  } catch (error) {
    console.error('Local color matching failed, falling back to server:', error);
    // Fallback to server if local matching fails
    const response = await fetch(`${API_BASE_URL}/match-color`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rgb }),
    });
    return handleResponse<ColorMatchResponse>(response);
  }
}
