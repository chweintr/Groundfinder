import { useEffect, useRef, useState } from "react";

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
}

export function UploadZone({ onFileSelect }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setDragging] = useState(false);

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            onFileSelect(file);
            event.preventDefault();
            break;
          }
        }
      }
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [onFileSelect]);

  function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file");
      return;
    }
    onFileSelect(file);
  }

  return (
    <div
      className={`upload-zone ${isDragging ? "dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleFiles(event.dataTransfer?.files ?? null);
      }}
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          inputRef.current?.click();
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(event) => handleFiles(event.target.files)}
        hidden
      />
      <p>Drop an image, click to browse, or paste from the clipboard.</p>
    </div>
  );
}

