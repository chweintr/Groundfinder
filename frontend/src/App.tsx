import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import "./App.css";

import {
  analyzeImage,
  asDataUrl,
  requestExport,
  requestGroundInside,
  requestMask,
  type GroundInsidePayload,
  type MaskRequestPayload,
} from "./api/client";
import { ExportPanel } from "./components/ExportPanel";
import { GroundPanel } from "./components/GroundPanel";
import { Histogram } from "./components/Histogram";
import { ImageViewer, type SampleInfo } from "./components/ImageViewer";
import { SamplerPanel } from "./components/SamplerPanel";
import { Tabs } from "./components/Tabs";
import { UploadZone } from "./components/UploadZone";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import type {
  AnalysisData,
  GroundSelection,
  ImageSelectionState,
  MaskMode,
  ViewMode,
} from "./types";
import { labToLch, relativeValue, rgbToXyz, toHex, xyzToLab } from "./utils/color";

const DEFAULT_VIEW: ViewMode = "highlight";
const MASK_MODES: MaskMode[] = ["value", "hue", "temperature", "cluster", "ground"];

interface OverlayState {
  highlight: string | null;
  wash: string | null;
  extract: string | null;
}

interface SampleState {
  point: { x: number; y: number } | null;
  rgb: { r: number; g: number; b: number } | null;
  lab: { L: number; a: number; b: number } | null;
  lch: { L: number; C: number; H: number } | null;
  hex: string | null;
  value: number | null;
}

function createDefaultGround(analysis: AnalysisData): GroundSelection {
  if (analysis.detectedGroundIndex !== null) {
    return {
      type: "detected",
      clusterRankIndex: analysis.detectedGroundIndex,
      tolerance: 6,
    };
  }
  return {
    type: "cluster",
    clusterRankIndex: 0,
    tolerance: 6,
  };
}

function valueRange(selection: ImageSelectionState): [number, number] {
  const lower = Math.max(0, Math.round(selection.valueCenter - selection.valueTolerance));
  const upper = Math.min(255, Math.round(selection.valueCenter + selection.valueTolerance));
  return [lower, upper];
}

function resolveGroundLab(analysis: AnalysisData, ground: GroundSelection) {
  if (ground.type === "lab" && ground.lab) return ground.lab;
  const rank =
    ground.clusterRankIndex ?? (analysis.detectedGroundIndex !== null ? analysis.detectedGroundIndex : 0);
  const cluster = analysis.clusters[rank] ?? analysis.clusters[0];
  return [cluster.center.lab[0], cluster.center.lab[1], cluster.center.lab[2]] as [number, number, number];
}

export default function App() {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [maskLoading, setMaskLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<ImageSelectionState | null>(null);
  const [overlays, setOverlays] = useState<OverlayState>({ highlight: null, wash: null, extract: null });
  const [groundInside, setGroundInside] = useState<{ highlight: string; coverage: number; pixels: number } | null>(
    null,
  );
  const [sample, setSample] = useState<SampleState>({
    point: null,
    rgb: null,
    lab: null,
    lch: null,
    hex: null,
    value: null,
  });
  const [activeTab, setActiveTab] = useState("histograms");
  const [tabs, setTabs] = useState<
    {
      id: string;
      label: string;
      content: ReactElement;
    }[]
  >([]);

  const activeOverlay = useMemo(() => {
    if (!selection) return null;
    return overlays[selection.view];
  }, [overlays, selection]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const fetchMask = useCallback(
    async (analysisData: AnalysisData, state: ImageSelectionState) => {
      setMaskLoading(true);
      setError(null);
      try {
        const payload: MaskRequestPayload = {
          analysisId: analysisData.analysisId,
          mode: state.mode,
          views: ["highlight", "wash", "extract"],
          upscale: true,
        };
        if (state.mode === "value") {
          payload.valueRange = valueRange(state);
        } else if (state.mode === "hue") {
          payload.hue = state.hue;
          payload.hueTolerance = state.hueTolerance;
        } else if (state.mode === "cluster") {
          payload.clusterRankIndex = state.clusterRankIndex;
        } else if (state.mode === "temperature") {
          payload.temperatureCategory = state.temperatureCategory;
        } else if (state.mode === "ground") {
          payload.groundTolerance = state.ground.tolerance;
          payload.groundLab = resolveGroundLab(analysisData, state.ground);
        }
        const response = await requestMask(payload);
        setOverlays({
          highlight: response.payload.highlight ? asDataUrl(response.payload.highlight) : null,
          wash: response.payload.wash ? asDataUrl(response.payload.wash) : null,
          extract: response.payload.extract ? asDataUrl(response.payload.extract) : null,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Mask update failed");
      } finally {
        setMaskLoading(false);
      }
    },
    [],
  );

  const updateSelection = useCallback(
    (update: Partial<ImageSelectionState>, refreshMask = true) => {
      setSelection((prev) => {
        if (!prev || !analysis) return prev;
        const next: ImageSelectionState = { ...prev, ...update } as ImageSelectionState;
        if (refreshMask) {
          void fetchMask(analysis, next);
        }
        return next;
      });
    },
    [analysis, fetchMask],
  );

  useKeyboardShortcuts({
    onViewChange: (view) => updateSelection({ view }, false),
    onToleranceAdjust: (delta) => {
      setSelection((prev) => {
        if (!prev || !analysis) return prev;
        if (prev.mode !== "value") return prev;
        const next = { ...prev, valueTolerance: Math.max(1, prev.valueTolerance + delta) } as ImageSelectionState;
        void fetchMask(analysis, next);
        return next;
      });
    },
  });

  const handleFileSelect = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      setGroundInside(null);
      setSample({ point: null, rgb: null, lab: null, lch: null, hex: null, value: null });
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
      const objectUrl = URL.createObjectURL(file);
      setImageUrl(objectUrl);
      try {
        const result = await analyzeImage(file);
        setAnalysis(result);
        const defaultGround = createDefaultGround(result);
        const initialSelection: ImageSelectionState = {
          mode: "value",
          view: DEFAULT_VIEW,
          valueCenter: result.valueMode.peakBin,
          valueTolerance: 2,
          hue: result.clusters[0]?.center.lch[2] ?? 0,
          hueTolerance: 12,
          clusterRankIndex: 0,
          temperatureCategory: "warm",
          ground: defaultGround,
        };
        setSelection(initialSelection);
        await fetchMask(result, initialSelection);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Analysis failed");
        setAnalysis(null);
        setSelection(null);
      } finally {
        setLoading(false);
      }
    },
    [fetchMask, imageUrl],
  );

  const handleSample = useCallback((info: SampleInfo) => {
    const { r, g, b } = info.color;
    const [X, Y, Z] = rgbToXyz(r, g, b);
    const lab = xyzToLab(X, Y, Z);
    const lch = labToLch(lab);
    setSample({
      point: { x: info.x, y: info.y },
      rgb: { r, g, b },
      lab,
      lch,
      hex: toHex(r, g, b),
      value: relativeValue(lab.L),
    });
  }, []);

  const setGroundFromSample = useCallback(() => {
    if (!analysis || !selection || !sample.lab) return;
    const nextGround: GroundSelection = {
      type: "lab",
      lab: [sample.lab.L, sample.lab.a, sample.lab.b],
      tolerance: selection.ground.tolerance,
    };
    const nextSelection: ImageSelectionState = { ...selection, mode: "ground", ground: nextGround };
    setSelection(nextSelection);
    void fetchMask(analysis, nextSelection);
  }, [analysis, selection, sample.lab, fetchMask]);

  const handleGroundInside = useCallback(async () => {
    if (!analysis || !selection) return;
    const payload: GroundInsidePayload = {
      analysisId: analysis.analysisId,
      groundSource: selection.ground.type,
      clusterRankIndex:
        selection.ground.type === "cluster" || selection.ground.type === "detected"
          ? selection.ground.clusterRankIndex ?? analysis.detectedGroundIndex ?? 0
          : undefined,
      groundLab: selection.ground.type === "lab" ? selection.ground.lab : undefined,
      groundTolerance: selection.ground.tolerance,
    };
    try {
      setMaskLoading(true);
      const response = await requestGroundInside(payload);
      setGroundInside({
        highlight: asDataUrl(response.highlight),
        coverage: response.coverage,
        pixels: response.pixels,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ground inside forms failed");
    } finally {
      setMaskLoading(false);
    }
  }, [analysis, selection]);

  const exportCurrent = useCallback(async () => {
    if (!analysis || !selection) throw new Error("No analysis available");
    const payload: MaskRequestPayload = {
      analysisId: analysis.analysisId,
      mode: selection.mode,
    };
    if (selection.mode === "value") {
      payload.valueRange = valueRange(selection);
    } else if (selection.mode === "hue") {
      payload.hue = selection.hue;
      payload.hueTolerance = selection.hueTolerance;
    } else if (selection.mode === "cluster") {
      payload.clusterRankIndex = selection.clusterRankIndex;
    } else if (selection.mode === "temperature") {
      payload.temperatureCategory = selection.temperatureCategory;
    } else if (selection.mode === "ground") {
      payload.groundTolerance = selection.ground.tolerance;
      payload.groundLab = resolveGroundLab(analysis, selection.ground);
    }
    return requestExport(payload);
  }, [analysis, selection]);

  useEffect(() => {
    if (!analysis || !selection) {
      setTabs([]);
      return;
    }
    const nextTabs = [
      {
        id: "histograms",
        label: "Histograms",
        content: (
          <div className="histograms">
            <Histogram title="Value" data={analysis.valueHistogram} color="#60a5fa" />
            <Histogram title="Hue" data={analysis.hueHistogram} color="#f97316" />
          </div>
        ),
      },
      {
        id: "clusters",
        label: "Clusters",
        content: (
          <div className="clusters">
            <p>Select a cluster to isolate its hue family.</p>
            <ul className="cluster-list">
              {analysis.clusters.map((cluster, index) => (
                <li key={index}>
                  <button
                    className={selection.clusterRankIndex === index ? "active" : ""}
                    onClick={() => updateSelection({ mode: "cluster", clusterRankIndex: index })}
                  >
                    <span>
                      #{index + 1} · {(cluster.percentage * 100).toFixed(1)}% · L {cluster.center.lab[0].toFixed(1)} C {cluster.center.lch[1].toFixed(1)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ),
      },
      {
        id: "ground",
        label: "Ground",
        content: (
          <GroundPanel
            ground={selection.ground}
            detectedGroundIndex={analysis.detectedGroundIndex}
            onUseDetected={() => {
              if (analysis.detectedGroundIndex !== null) {
                updateSelection(
                  {
                    mode: "ground",
                    ground: {
                      type: "detected",
                      clusterRankIndex: analysis.detectedGroundIndex,
                      tolerance: selection.ground.tolerance,
                    },
                  },
                );
              }
            }}
            onUseCluster={() => {
              updateSelection({
                mode: "ground",
                ground: {
                  type: "cluster",
                  clusterRankIndex: selection.clusterRankIndex,
                  tolerance: selection.ground.tolerance,
                },
              });
            }}
            onToleranceChange={(value) => updateSelection({ ground: { ...selection.ground, tolerance: value } })}
            onGroundInside={handleGroundInside}
            insideCoverage={groundInside?.coverage ?? null}
            insidePixels={groundInside?.pixels ?? null}
            busy={maskLoading}
          />
        ),
      },
      {
        id: "sampler",
        label: "Sampler",
        content: (
          <SamplerPanel
            rgb={sample.rgb}
            lab={sample.lab}
            lch={sample.lch}
            hex={sample.hex}
            relativeValue={sample.value}
            onSetGround={sample.lab ? setGroundFromSample : undefined}
          />
        ),
      },
      {
        id: "export",
        label: "Export",
        content: <ExportPanel onExport={exportCurrent} />,
      },
    ];
    setTabs(nextTabs);
  }, [analysis, selection, updateSelection, groundInside, maskLoading, sample, setGroundFromSample, exportCurrent, handleGroundInside]);

  useEffect(() => {
    if (!tabs.length) return;
    if (!tabs.find((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  if (!analysis || !selection || !imageUrl) {
    return (
      <div className="app">
        <header>
          <h1>GroundFinder</h1>
          <p>Analyze dominant tone, value, temperature, and ground passages.</p>
        </header>
        <main>
          {loading ? <p>Analyzing image…</p> : <UploadZone onFileSelect={handleFileSelect} />}
          {error && <p className="error">{error}</p>}
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>GroundFinder</h1>
        <div className="status">
          <span>
            {analysis.originalSize[1]}×{analysis.originalSize[0]} px
          </span>
          {maskLoading && <span className="spinner">Updating overlay…</span>}
          {error && <span className="error">{error}</span>}
        </div>
      </header>
      <main className="layout">
        <section className="canvas-pane">
          <div className="mode-controls">
            <div className="view-toggle">
              {(["highlight", "wash", "extract"] as ViewMode[]).map((view) => (
                <button
                  key={view}
                  className={selection.view === view ? "active" : ""}
                  onClick={() => updateSelection({ view }, false)}
                >
                  {view}
                </button>
              ))}
            </div>
            <div className="mask-modes">
              {MASK_MODES.map((mode) => (
                <button
                  key={mode}
                  className={selection.mode === mode ? "active" : ""}
                  onClick={() => updateSelection({ mode }, true)}
                >
                  {mode}
                </button>
              ))}
            </div>
            {selection.mode === "value" && (
              <label className="tolerance">
                Value tolerance ±{selection.valueTolerance} bins
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={selection.valueTolerance}
                  onChange={(event) => updateSelection({ valueTolerance: Number(event.target.value) })}
                />
                <span>
                  Bin {valueRange(selection)[0]} – {valueRange(selection)[1]}
                </span>
              </label>
            )}
            {selection.mode === "hue" && (
              <label className="tolerance">
                Hue tolerance ±{selection.hueTolerance}°
                <input
                  type="range"
                  min={2}
                  max={90}
                  value={selection.hueTolerance}
                  onChange={(event) => updateSelection({ hueTolerance: Number(event.target.value) })}
                />
                <span>{selection.hue.toFixed(1)}°</span>
              </label>
            )}
            {selection.mode === "temperature" && (
              <div className="temperature-options">
                {(["warm", "cool", "neutral"] as const).map((option) => (
                  <button
                    key={option}
                    className={selection.temperatureCategory === option ? "active" : ""}
                    onClick={() => updateSelection({ temperatureCategory: option })}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
            {groundInside && (
              <div className="ground-overlay-preview">
                <p>Ground inside forms</p>
                <img src={groundInside.highlight} alt="Ground inside forms" />
                <small>
                  {Math.round(groundInside.coverage * 1000) / 10}% · {groundInside.pixels.toLocaleString()} px
                </small>
              </div>
            )}
          </div>
          <ImageViewer
            imageUrl={imageUrl}
            overlayUrl={activeOverlay}
            viewMode={selection.view}
            mode={selection.mode}
            onSample={handleSample}
            samplePoint={sample.point}
          />
        </section>
        <section className="sidebar">
          <Tabs tabs={tabs} activeId={activeTab} onChange={setActiveTab} />
        </section>
      </main>
    </div>
  );
}
