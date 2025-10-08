import { useEffect } from "react";

interface Options {
  onViewChange: (view: "highlight" | "wash" | "extract") => void;
  onToleranceAdjust: (delta: number) => void;
}

export function useKeyboardShortcuts({ onViewChange, onToleranceAdjust }: Options) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (event.key === "1") {
        onViewChange("highlight");
      } else if (event.key === "2") {
        onViewChange("wash");
      } else if (event.key === "3") {
        onViewChange("extract");
      } else if (event.key === "[") {
        onToleranceAdjust(-1);
      } else if (event.key === "]") {
        onToleranceAdjust(1);
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onToleranceAdjust, onViewChange]);
}

