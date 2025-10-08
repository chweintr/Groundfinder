import type {
  AnalysisData,
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
