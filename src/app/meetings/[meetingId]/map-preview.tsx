"use client";

import { useEffect, useRef, useState } from "react";

// X-Frame-Options 차단 시 onError가 발동하지 않으므로 폴백 전환까지 대기하는 시간(ms)
const IFRAME_LOAD_TIMEOUT_MS = 5000;

type MapPreviewProps = {
  embedUrl: string;
  locationText: string;
  placeLink: string;
};

export function MapPreview({ embedUrl, locationText, placeLink }: MapPreviewProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setStatus((prev) => (prev === "loading" ? "error" : prev));
    }, IFRAME_LOAD_TIMEOUT_MS);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  function handleLoad() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    setStatus("loaded");
  }

  function handleError() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    setStatus("error");
  }

  if (status === "error") {
    return (
      <a
        href={placeLink}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-sm"
        style={{ color: "var(--accent)" }}
      >
        {locationText}
        <span aria-hidden="true">↗</span>
      </a>
    );
  }

  return (
    <div className="mt-2 w-full">
      <div
        className="relative w-full overflow-hidden rounded-xl border"
        style={{ aspectRatio: "16/9", maxHeight: "200px", borderColor: "var(--line)" }}
      >
        {/* 로딩 중 placeholder */}
        {status === "loading" && (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-0 flex items-center justify-center text-sm"
            style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink-soft)" }}
          >
            지도 로딩중...
          </div>
        )}
        <iframe
          src={embedUrl}
          title="지도 미리보기"
          className="absolute inset-0 h-full w-full"
          style={{ opacity: status === "loaded" ? 1 : 0 }}
          sandbox="allow-scripts allow-same-origin"
          referrerPolicy="no-referrer"
          loading="lazy"
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
      <a
        href={placeLink}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-flex items-center gap-1 text-xs"
        style={{ color: "var(--ink-soft)" }}
      >
        지도에서 보기
        <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}
