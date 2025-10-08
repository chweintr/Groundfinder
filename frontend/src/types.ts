export type ViewMode = "highlight" | "wash" | "extract";
export type MaskMode = "value" | "hue" | "cluster" | "temperature" | "ground";

export interface ClusterCenter {
  lab: number[];
  lch: number[];
}

export interface ClusterSummary {
  index: number;
  pixelCount: number;
  percentage: number;
  center: ClusterCenter;
}

export interface ValueModeSummary {
  peakBin: number;
  lowerBin: number;
  upperBin: number;
}

export interface AnalysisData {
  analysisId: string;
  originalSize: [number, number];
  analysisSize: [number, number];
  downscaleRatio: number;
  valueHistogram: number[];
  hueHistogram: number[];
  temperatureCounts: Record<string, number>;
  clusters: ClusterSummary[];
  valueMode: ValueModeSummary;
  detectedGroundIndex: number | null;
  temperatureDefaults: {
    warmUpper: number;
    coolLower: number;
    coolUpper: number;
    neutralChroma: number;
  };
}

export interface MaskPayload {
  [view: string]: string;
}

export interface MaskResponse {
  analysisId: string;
  mode: MaskMode;
  payload: MaskPayload;
}

export interface GroundInsideResponse {
  analysisId: string;
  highlight: string;
  coverage: number;
  pixels: number;
}

export interface ExportResponse {
  analysisId: string;
  highlight: string;
  wash: string;
  extract: string;
  summary: Record<string, unknown>;
}

export interface GroundSelection {
  type: "detected" | "cluster" | "lab";
  clusterRankIndex?: number;
  lab?: [number, number, number];
  tolerance: number;
}

export interface ImageSelectionState {
  mode: MaskMode;
  view: ViewMode;
  valueCenter: number;
  valueTolerance: number;
  hue: number;
  hueTolerance: number;
  clusterRankIndex: number;
  temperatureCategory: "warm" | "cool" | "neutral";
  ground: GroundSelection;
}
