import { useCallback, useEffect, useState } from "react";
import "./App.css";

import { analyzeImage, requestGroundInside, asDataUrl, type GroundInsidePayload } from "./api/client";
import { UploadZone } from "./components/UploadZone";
import type { AnalysisData } from "./types";

export default function App() {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groundHighlight, setGroundHighlight] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const handleFileSelect = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      setGroundHighlight(null);
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
          const groundCluster = result.clusters[result.detectedGroundIndex];
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

  const topSuggestion = analysis.groundSuggestions[0];

  return (
    <div className="app simple">
      <header>
        <h1>GroundFinder</h1>
      </header>
      <main className="simple-layout">
        <div className="image-container">
          <div className="image-wrapper">
            <img src={imageUrl} alt="Analyzed painting" />
            {groundHighlight && <img src={groundHighlight} alt="Ground highlight" className="overlay" />}
          </div>
        </div>
        <aside className="recommendation-panel">
          {topSuggestion ? (
            <>
              <div className="swatch" style={{ backgroundColor: topSuggestion.color.hex }} />
              <div className="details">
                <h2>Dominant Ground</h2>
                <p className="value-label">
                  {topSuggestion.valueLabel} · Value {topSuggestion.valueStep}
                </p>
                <p className="temp-label">{topSuggestion.color.temperature}</p>
                <p className="coverage">{Math.round(topSuggestion.coverage * 100)}% coverage</p>
                <p className="hex">{topSuggestion.color.hex}</p>
              </div>
              {topSuggestion.paletteMatches.length > 0 && (
                <div className="mixing-recommendation">
                  <h3>Closest Match</h3>
                  <div className="match">
                    <div
                      className="match-swatch"
                      style={{ backgroundColor: topSuggestion.paletteMatches[0].hex }}
                    />
                    <div>
                      <p className="match-name">{topSuggestion.paletteMatches[0].name}</p>
                      <p className="match-recipe">{topSuggestion.paletteMatches[0].recipe}</p>
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
