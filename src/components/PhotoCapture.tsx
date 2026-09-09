import React, { useCallback, useEffect, useRef, useState } from "react";

interface PhotoCaptureProps {
  onPhotoCapture: (blob: Blob) => void;
  onPhotoRemove: () => void;
  error?: string;
}

const MAX_SIZE_PX = 1200;
const JPEG_QUALITY = 0.82;
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB threshold for compression

/**
 * Compress and resize a large image to keep storage manageable.
 * Returns a Blob at JPEG quality.
 */
async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Only resize if larger than MAX_SIZE_PX
      if (width > MAX_SIZE_PX || height > MAX_SIZE_PX) {
        const ratio = Math.min(MAX_SIZE_PX / width, MAX_SIZE_PX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed"));
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    img.src = url;
  });
}

export function PhotoCapture({
  onPhotoCapture,
  onPhotoRemove,
  error,
}: PhotoCaptureProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sizeInfo, setSizeInfo] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsProcessing(true);
      try {
        let blob: Blob = file;

        // Compress large images
        if (file.size > MAX_BYTES || file.type !== "image/jpeg") {
          blob = await compressImage(file);
        }

        const objectUrl = URL.createObjectURL(blob);
        if (preview) URL.revokeObjectURL(preview);
        setPreview(objectUrl);
        setSizeInfo(`${(blob.size / 1024).toFixed(0)} KB`);
        onPhotoCapture(blob);
      } catch (err) {
        console.error("Photo processing error:", err);
      } finally {
        setIsProcessing(false);
        // Reset input so same file can be selected again
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [preview, onPhotoCapture]
  );

  const handleRemove = useCallback(() => {
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
    setSizeInfo("");
    onPhotoRemove();
    if (inputRef.current) inputRef.current.value = "";
  }, [preview, onPhotoRemove]);

  return (
    <div className="photo-capture">
      <input
        ref={inputRef}
        id="photo-input"
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleFileChange}
        aria-label="Capture or upload photo of planted tree"
      />

      {!preview ? (
        <label
          htmlFor="photo-input"
          className={`photo-placeholder ${error ? "photo-placeholder--error" : ""}`}
        >
          {isProcessing ? (
            <div className="photo-processing">
              <div className="spinner"></div>
              <span>Processing image…</span>
            </div>
          ) : (
            <>
              <div className="photo-icon">📷</div>
              <p className="photo-label-primary">Tap to take photo</p>
              <p className="photo-label-secondary">or choose from gallery</p>
            </>
          )}
        </label>
      ) : (
        <div className="photo-preview-container">
          <img
            src={preview}
            alt="Selected tree photo"
            className="photo-preview"
          />
          <div className="photo-preview-overlay">
            <span className="photo-size-badge">{sizeInfo}</span>
            <button
              type="button"
              onClick={handleRemove}
              className="btn-replace"
              aria-label="Replace photo"
            >
              <span>🔄</span>
              Replace
            </button>
          </div>
        </div>
      )}

      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
