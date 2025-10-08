import { useState } from "react";
import type { ExportResponse, ViewMode } from "../types";
import { asDataUrl } from "../api/client";

interface ExportPanelProps {
  onExport: () => Promise<ExportResponse>;
}

const VIEWS: ViewMode[] = ["highlight", "wash", "extract"];

export function ExportPanel({ onExport }: ExportPanelProps) {
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [result, setResult] = useState<ExportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setStatus("working");
    setError(null);
    try {
      const payload = await onExport();
      setResult(payload);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  const imageMap = result
    ? {
        highlight: result.highlight,
        wash: result.wash,
        extract: result.extract,
      }
    : null;

  return (
    <div className="export-panel">
      <button type="button" onClick={handleExport} disabled={status === "working"}>
        {status === "working" ? "Exporting…" : "Export PNGs + JSON"}
      </button>
      {status === "error" && error && <p className="error">{error}</p>}
      {result && imageMap && (
        <div className="export-results">
          <p>Download your overlays and summary.</p>
          <div className="export-grid">
            {VIEWS.map((view) => (
              <a key={view} href={asDataUrl(imageMap[view])} download={`groundfinder-${view}.png`}>
                {view}
              </a>
            ))}
            <a
              href={`data:application/json;charset=utf-8,${encodeURIComponent(
                JSON.stringify(result.summary, null, 2),
              )}`}
              download="groundfinder-summary.json"
            >
              summary.json
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

