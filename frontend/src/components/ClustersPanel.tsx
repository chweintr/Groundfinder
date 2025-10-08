import type { ClusterSummary } from "../types";
import { toHex } from "../utils/color";

interface ClustersPanelProps {
  clusters: ClusterSummary[];
  activeIndex: number | null;
  onSelect: (rankIndex: number) => void;
  detectedGroundIndex: number | null;
}

export function ClustersPanel({ clusters, activeIndex, onSelect, detectedGroundIndex }: ClustersPanelProps) {
  return (
    <div className="clusters-panel">
      {clusters.map((cluster, rankIndex) => {
        const rgb = labToApproxRgb(cluster.center.lab);
        const hex = toHex(rgb.r, rgb.g, rgb.b);
        const isActive = activeIndex === rankIndex;
        const isGround = detectedGroundIndex === rankIndex;
        return (
          <button
            key={rankIndex}
            className={`cluster-item ${isActive ? "active" : ""}`}
            onClick={() => onSelect(rankIndex)}
          >
            <span className="swatch" style={{ backgroundColor: hex }} />
            <span className="label">
              Cluster {rankIndex + 1}
              <small>
                {(cluster.percentage * 100).toFixed(1)}% · L {cluster.center.lab[0].toFixed(1)} C {cluster.center.lch[1].toFixed(1)}
              </small>
              {isGround && <small className="ground-tag">Detected ground</small>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function labToApproxRgb([L, a, b]: number[]) {
  // rough Lab -> sRGB just for swatch visualization using inverse of our forward transform.
  const y = (L + 16) / 116;
  const x = a / 500 + y;
  const z = y - b / 200;

  const X = 0.95047 * labInverse(x);
  const Y = 1.0 * labInverse(y);
  const Z = 1.08883 * labInverse(z);

  const rl = X * 3.2404542 + Y * -1.5371385 + Z * -0.4985314;
  const gl = X * -0.9692660 + Y * 1.8760108 + Z * 0.0415560;
  const bl = X * 0.0556434 + Y * -0.2040259 + Z * 1.0572252;

  return {
    r: linearToSrgb(rl),
    g: linearToSrgb(gl),
    b: linearToSrgb(bl),
  };
}

function labInverse(t: number): number {
  const epsilon = 0.008856;
  const kappa = 903.3;
  return t ** 3 > epsilon ? t ** 3 : (116 * t - 16) / kappa;
}

function linearToSrgb(channel: number): number {
  const value = Math.max(0, Math.min(1, channel));
  if (value <= 0.0031308) {
    return Math.round(value * 12.92 * 255);
  }
  return Math.round((1.055 * Math.pow(value, 1 / 2.4) - 0.055) * 255);
}

