import { useCallback, useEffect, useState } from "react";
import "./App.css";

import { analyzeImage, requestGroundInside, asDataUrl, matchColor, type GroundInsidePayload } from "./api/client";
import { UploadZone } from "./components/UploadZone";
import { ImageViewer, type SampleInfo } from "./components/ImageViewer";
import type { AnalysisData, ColorMatchResponse, GroundSuggestion } from "./types";

export default function App() {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groundHighlight, setGroundHighlight] = useState<string | null>(null);
  const [sampledColor, setSampledColor] = useState<ColorMatchResponse | null>(null);
  const [samplePoint, setSamplePoint] = useState<{ x: number; y: number } | null>(null);
  const [enhancedGroundSuggestion, setEnhancedGroundSuggestion] = useState<GroundSuggestion | null>(null);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  // Enhance ground suggestion with real mixing recipe
  useEffect(() => {
    const enhanceGroundWithMixing = async () => {
      if (!analysis || !analysis.groundSuggestions[0]) {
        setEnhancedGroundSuggestion(null);
        return;
      }

      const topSuggestion = analysis.groundSuggestions[0];
      try {
        // Get real mixing recipe from color mixer
        const mixingResult = await matchColor(topSuggestion.color.rgb);
        
        // Merge the real mixing recipe into the ground suggestion
        setEnhancedGroundSuggestion({
          ...topSuggestion,
          paletteMatches: mixingResult.paletteMatches,
        });
      } catch (error) {
        console.error('Failed to enhance ground with mixing recipe:', error);
        // Fall back to original suggestion
        setEnhancedGroundSuggestion(topSuggestion);
      }
    };

    enhanceGroundWithMixing();
  }, [analysis]);

  const handleFileSelect = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      setGroundHighlight(null);
      setSampledColor(null);
      setSamplePoint(null);
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
      const objectUrl = URL.createObjectURL(file);
      setImageUrl(objectUrl);
      try {
        const result = await analyzeImage(file);
        setAnalysis(result);

        // Auto-request ground highlight
        if (result.detectedGroundIndex !== null && result.clusters[result.detectedGroundIndex]) {
          const payload: GroundInsidePayload = {
            analysisId: result.analysisId,
            groundSource: "detected",
            clusterRankIndex: result.detectedGroundIndex,
            groundTolerance: 6,
          };
          const response = await requestGroundInside(payload);
          setGroundHighlight(asDataUrl(response.highlight));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Analysis failed");
        setAnalysis(null);
      } finally {
        setLoading(false);
      }
    },
    [imageUrl],
  );

  const handleColorSample = useCallback(async (info: SampleInfo) => {
    setSamplePoint({ x: info.x, y: info.y });
    try {
      const rgb = [info.color.r, info.color.g, info.color.b];
      const result = await matchColor(rgb);
      setSampledColor(result);
    } catch (err) {
      console.error("Color matching failed", err);
    }
  }, []);

  const handleReset = useCallback(() => {
    setAnalysis(null);
    setImageUrl(null);
    setGroundHighlight(null);
    setSampledColor(null);
    setSamplePoint(null);
    setError(null);
  }, []);

  if (!analysis || !imageUrl) {
    return (
      <div className="app">
        <header>
          <h1>GroundFinder</h1>
          <p>Analyze and identify the dominant ground color in your painting</p>
        </header>
        <main>
          {loading ? <p>Analyzing image…</p> : <UploadZone onFileSelect={handleFileSelect} />}
          {error && <p className="error">{error}</p>}
        </main>
      </div>
    );
  }

  // Use enhanced ground suggestion with real mixing recipe
  const topSuggestion = enhancedGroundSuggestion || analysis.groundSuggestions[0];

  return (
    <div className="app simple">
      <header>
        <h1>GroundFinder</h1>
        <button className="reset-button" onClick={handleReset}>Analyze New Image</button>
      </header>
      <main className="simple-layout">
        <div className="image-container">
          <div className="image-wrapper">
            <ImageViewer
              imageUrl={imageUrl}
              overlayUrl={groundHighlight}
              viewMode="highlight"
              mode="ground"
              onSample={handleColorSample}
              samplePoint={samplePoint}
            />
            <p className="color-picker-hint">👆 Tap or click any part of the painting to see mixing recipes for that color</p>
          </div>

          {sampledColor && (
            <div className="color-dropper-bottom">
              <h3>Color You Sampled</h3>
              <div className="dropper-content">
                <div className="dropper-swatch-large" style={{ backgroundColor: sampledColor.color.hex }} />
                <div className="dropper-info">
                  <p className="dropper-hex-large">{sampledColor.color.hex}</p>
                  <p className="dropper-temp-large">{sampledColor.color.temperature}</p>
                  {sampledColor.paletteMatches.length > 0 && (
                    <div className="dropper-recipe-bottom">
                      <p className="dropper-recipe-label">How to mix it:</p>
                      <p className="dropper-recipe-name-bottom">{sampledColor.paletteMatches[0].name}</p>
                      <p className="dropper-recipe-mix-bottom">{sampledColor.paletteMatches[0].recipe}</p>
                      <p className="dropper-delta-bottom">Similarity: {(100 - sampledColor.paletteMatches[0].deltaE).toFixed(1)}%</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        <aside className="recommendation-panel">
          {topSuggestion ? (
            <>
              <div className="swatch" style={{ backgroundColor: topSuggestion.color.hex }} />
              <div className="details">
                <h2>Dominant Ground</h2>
                <p className="ground-explanation">
                  A toned ground unifies your palette and establishes value from the start
                </p>
                <p className="value-label">
                  {topSuggestion.valueLabel} · Value {topSuggestion.valueStep}
                </p>
                <p className="temp-label">{topSuggestion.color.temperature}</p>
                <p className="coverage">{Math.round(topSuggestion.coverage * 100)}% coverage</p>
                <p className="hex">{topSuggestion.color.hex}</p>
              </div>
              {topSuggestion.paletteMatches.length > 0 && (
                <div className="mixing-recommendation">
                  <h3>How to Mix This Ground Color</h3>
                  <div className="match-comparison">
                    <div className="comparison-swatches">
                      <div className="comparison-item">
                        <div
                          className="match-swatch"
                          style={{ backgroundColor: topSuggestion.color.hex }}
                        />
                        <span className="swatch-label">Your Ground</span>
                      </div>
                      <div className="comparison-item">
                        <div
                          className="match-swatch"
                          style={{ backgroundColor: topSuggestion.paletteMatches[0].hex }}
                        />
                        <span className="swatch-label">Mixed Result</span>
                      </div>
                    </div>
                    <div className="match-details">
                      <p className="match-recipe">{topSuggestion.paletteMatches[0].recipe}</p>
                      <p className="match-delta">Similarity: {(100 - topSuggestion.paletteMatches[0].deltaE).toFixed(1)}%</p>
                      {topSuggestion.paletteMatches[0].notes && (
                        <p className="match-notes">{topSuggestion.paletteMatches[0].notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p>No dominant ground detected</p>
          )}
        </aside>
      </main>
    </div>
  );
}
