import { useEffect, useRef, useState } from "react";
import type { MaskMode, ViewMode } from "../types";

export interface SampleInfo {
  x: number;
  y: number;
  color: { r: number; g: number; b: number; a: number };
}

interface ImageViewerProps {
  imageUrl: string;
  overlayUrl?: string | null;
  viewMode: ViewMode;
  mode: MaskMode;
  onSample: (info: SampleInfo) => void;
  samplePoint?: { x: number; y: number } | null;
}

export function ImageViewer({ imageUrl, overlayUrl, onSample, samplePoint }: ImageViewerProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    function draw(targetImg: HTMLImageElement, targetCanvas: HTMLCanvasElement) {
      targetCanvas.width = targetImg.naturalWidth;
      targetCanvas.height = targetImg.naturalHeight;
      setNaturalSize({ width: targetImg.naturalWidth, height: targetImg.naturalHeight });
      const ctx = targetCanvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
      ctx.drawImage(targetImg, 0, 0, targetCanvas.width, targetCanvas.height);
      updateDisplaySize(targetImg);
    }

    function updateDisplaySize(targetImg: HTMLImageElement) {
      const rect = targetImg.getBoundingClientRect();
      setDisplaySize({ width: rect.width, height: rect.height });
    }

    const invokeDraw = () => draw(img, canvas);

    if (img.complete) {
      invokeDraw();
    } else {
      img.onload = () => invokeDraw();
    }

    const observer = new ResizeObserver(() => updateDisplaySize(img));
    observer.observe(img);

    return () => {
      img.onload = null;
      observer.disconnect();
    };
  }, [imageUrl]);

  function handlePointer(event: React.MouseEvent<HTMLImageElement>) {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const rect = img.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const relativeY = event.clientY - rect.top;
    if (relativeX < 0 || relativeY < 0 || relativeX > rect.width || relativeY > rect.height) {
      return;
    }

    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    const x = Math.min(Math.max(Math.round(relativeX * scaleX), 0), img.naturalWidth - 1);
    const y = Math.min(Math.max(Math.round(relativeY * scaleY), 0), img.naturalHeight - 1);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    onSample({
      x,
      y,
      color: { r: pixel[0] ?? 0, g: pixel[1] ?? 0, b: pixel[2] ?? 0, a: pixel[3] ?? 255 },
    });
  }

  const markerStyle = (() => {
    if (!samplePoint || !naturalSize.width || !naturalSize.height) return undefined;
    const scaleX = displaySize.width / naturalSize.width;
    const scaleY = displaySize.height / naturalSize.height;
    return {
      left: `${samplePoint.x * scaleX}px`,
      top: `${samplePoint.y * scaleY}px`,
    };
  })();

  return (
    <div className="image-viewer">
      <img
        ref={imageRef}
        src={imageUrl}
        alt="Uploaded"
        className="base"
        onClick={handlePointer}
      />
      {overlayUrl && <img src={overlayUrl} alt="Overlay" className="overlay" />}
      <canvas ref={canvasRef} className="hidden-canvas" />
      {markerStyle && <div className="sample-marker" style={markerStyle} />}
    </div>
  );
}
