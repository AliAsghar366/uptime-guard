"use client";

import { useRef, useState, type MouseEvent } from "react";
import { MapPin } from "lucide-react";

export function ReferencePhotoPicker() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [marker, setMarker] = useState<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLDivElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setMarker(null);
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  }

  function handleImageClick(e: MouseEvent<HTMLDivElement>) {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setMarker({ x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input
        type="file"
        name="picture"
        accept="image/*"
        onChange={handleFileChange}
        title="Reference photo showing the exact lubrication point"
        className="max-w-[220px] text-[11px] text-white/60 file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-white/80"
      />
      {previewUrl ? (
        <div className="flex flex-col gap-1">
          <div
            ref={imgRef}
            onClick={handleImageClick}
            className="relative h-28 w-28 cursor-crosshair overflow-hidden rounded-lg border border-white/15 bg-black/20"
            style={{ backgroundImage: `url(${previewUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
          >
            {marker ? (
              <MapPin
                size={22}
                className="absolute -translate-x-1/2 -translate-y-full text-[var(--color-status-overdue)] drop-shadow-[0_0_3px_rgba(0,0,0,0.8)]"
                style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }}
                fill="currentColor"
              />
            ) : null}
          </div>
          <span className="text-[10px] text-white/45">
            {marker ? "Click again to move the pin" : "Click the exact grease point to pin it"}
          </span>
        </div>
      ) : null}
      <input type="hidden" name="markerX" value={marker ? marker.x.toFixed(4) : ""} />
      <input type="hidden" name="markerY" value={marker ? marker.y.toFixed(4) : ""} />
    </div>
  );
}