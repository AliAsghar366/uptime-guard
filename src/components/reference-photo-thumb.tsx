import Image from "next/image";
import { ImageOff, MapPin } from "lucide-react";

export function ReferencePhotoThumb({
  photoUrl,
  markerX,
  markerY,
  alt,
  size = 64,
  pinSize = 20,
}: {
  photoUrl: string | null;
  markerX: number | null;
  markerY: number | null;
  alt: string;
  size?: number;
  pinSize?: number;
}) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5"
      style={{ width: size, height: size }}
    >
      {photoUrl ? (
        <>
          {/* unoptimized: this is served from an authenticated same-origin route -- Next's Image
              Optimizer makes its own server-side fetch that never carries the browser's session
              cookie, so it always 401s against /api/files/... unless optimization is skipped. */}
          <Image src={photoUrl} alt={alt} fill sizes={`${size}px`} className="object-cover" unoptimized />
          {markerX !== null && markerY !== null ? (
            <MapPin
              size={pinSize}
              className="absolute -translate-x-1/2 -translate-y-full text-[var(--color-status-overdue)] drop-shadow-[0_0_3px_rgba(0,0,0,0.9)]"
              style={{ left: `${markerX * 100}%`, top: `${markerY * 100}%` }}
              fill="currentColor"
            />
          ) : null}
        </>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center text-white/25">
          <ImageOff size={Math.round(size * 0.28)} strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}