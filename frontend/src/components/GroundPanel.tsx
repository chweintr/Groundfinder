import type { GroundSelection } from "../types";

interface GroundPanelProps {
  ground: GroundSelection;
  detectedGroundIndex: number | null;
  onUseDetected: () => void;
  onUseCluster: () => void;
  onToleranceChange: (value: number) => void;
  onGroundInside: () => Promise<void>;
  insideCoverage: number | null;
  insidePixels: number | null;
  busy: boolean;
}

export function GroundPanel({
  ground,
  detectedGroundIndex,
  onUseDetected,
  onUseCluster,
  onToleranceChange,
  onGroundInside,
  insideCoverage,
  insidePixels,
  busy,
}: GroundPanelProps) {
  return (
    <div className="ground-panel">
      <div className="actions">
        <button type="button" onClick={onUseDetected} disabled={detectedGroundIndex === null}>
          Use detected near-neutral cluster
        </button>
        <button type="button" onClick={onUseCluster}>
          Use active cluster as ground
        </button>
      </div>
      <label>
        Ground tolerance
        <input
          type="range"
          min={2}
          max={20}
          value={ground.tolerance}
          onChange={(event) => onToleranceChange(Number(event.target.value))}
        />
        <span>{ground.tolerance.toFixed(1)} ΔE</span>
      </label>
      <button type="button" onClick={onGroundInside} disabled={busy}>
        {busy ? "Analyzing…" : "Ground inside forms"}
      </button>
      {insideCoverage !== null && insidePixels !== null && (
        <p className="metrics">
          Coverage {Math.round(insideCoverage * 1000) / 10}% · {insidePixels.toLocaleString()} px
        </p>
      )}
    </div>
  );
}

