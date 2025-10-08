import { useState } from "react";
import type { LabColor, LchColor } from "../utils/color";

interface SamplerPanelProps {
  rgb: { r: number; g: number; b: number } | null;
  lab: LabColor | null;
  lch: LchColor | null;
  hex: string | null;
  relativeValue: number | null;
  onSetGround?: () => void;
}

export function SamplerPanel({ rgb, lab, lch, hex, relativeValue, onSetGround }: SamplerPanelProps) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch (error) {
      console.error("Clipboard error", error);
    }
  }

  async function openPaintMaker() {
    if (!rgb) return;
    const rgbString = `${rgb.r},${rgb.g},${rgb.b}`;
    try {
      await navigator.clipboard.writeText(rgbString);
    } catch (error) {
      console.warn("Clipboard copy failed", error);
    }
    // PaintMaker may deny iframe embedding; opening a new tab keeps the
    // experience reliable while still handing the RGB mix to the clipboard.
    window.open("https://sensuallogic.com/paintmaker", "_blank", "noopener");
  }

  return (
    <div className="sampler-panel">
      {rgb ? (
        <>
          <div className="sample-row">
            <span>RGB</span>
            <span>
              {rgb.r}, {rgb.g}, {rgb.b}
            </span>
            <button type="button" onClick={() => copy(`${rgb.r},${rgb.g},${rgb.b}`, "rgb")}>Copy RGB</button>
          </div>
          {lab && (
            <div className="sample-row">
              <span>Lab</span>
              <span>
                {lab.L.toFixed(2)}, {lab.a.toFixed(2)}, {lab.b.toFixed(2)}
              </span>
              <button
                type="button"
                onClick={() =>
                  copy(`${lab.L.toFixed(2)},${lab.a.toFixed(2)},${lab.b.toFixed(2)}`, "lab")
                }
              >
                Copy Lab
              </button>
            </div>
          )}
          {lch && (
            <div className="sample-row">
              <span>LCH</span>
              <span>
                {lch.L.toFixed(2)}, {lch.C.toFixed(2)}, {lch.H.toFixed(1)}°
              </span>
            </div>
          )}
          {hex && (
            <div className="sample-row">
              <span>Hex</span>
              <span>{hex}</span>
            </div>
          )}
          {relativeValue !== null && (
            <div className="sample-row">
              <span>Value</span>
              <span>{relativeValue.toFixed(1)}</span>
            </div>
          )}
          {onSetGround && (
            <button type="button" onClick={onSetGround}>
              Use as ground color
            </button>
          )}
          <button type="button" onClick={openPaintMaker} className="paintmaker">
            Open in PaintMaker
          </button>
          {copied && <p className="copied">Copied {copied}</p>}
        </>
      ) : (
        <p>Click the image to sample a color.</p>
      )}
    </div>
  );
}
