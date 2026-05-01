"use client";

import { useEffect, useRef, useState } from "react";
import type { MapProvider } from "@/lib/location-utils";

// X-Frame-Options 차단 시 onError가 발동하지 않으므로 폴백 전환까지 대기하는 시간(ms)
const IFRAME_LOAD_TIMEOUT_MS = 5000;

type MapPreviewProps = {
  provider: MapProvider;
  embedUrl: string;
  locationText: string;
  placeLink: string;
};

type KakaoPlace = {
  place_name: string;
  x: string;
  y: string;
};

type KakaoLatLng = object;

type KakaoMapsApi = {
  load: (callback: () => void) => void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => object;
  Marker: new (options: { map: object; position: KakaoLatLng }) => object;
  services: {
    Status: { OK: string };
    Places: new () => {
      keywordSearch: (
        query: string,
        callback: (data: KakaoPlace[], status: string) => void
      ) => void;
    };
  };
};

declare global {
  interface Window {
    kakao?: {
      maps: KakaoMapsApi;
    };
  }
}

function displayLocationText(locationText: string, placeLink: string): string {
  return locationText.replace(placeLink, "").replace(/\s*\/\s*$/, "").trim() || locationText;
}

function MapLinkCard({
  locationText,
  placeLink,
}: {
  locationText: string;
  placeLink: string;
}) {
  const label = displayLocationText(locationText, placeLink);

  return (
    <div className="mt-2 rounded-xl border p-3" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
          {label}
        </p>
        <a
          href={placeLink}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-press inline-flex h-9 shrink-0 items-center justify-center rounded-full border px-3 text-sm font-bold"
          style={{ borderColor: "rgba(13, 127, 242, 0.25)", backgroundColor: "var(--accent-weak)", color: "var(--accent-strong)" }}
        >
          지도 열기
        </a>
      </div>
    </div>
  );
}

function loadKakaoMaps(appKey: string): Promise<KakaoMapsApi> {
  if (window.kakao?.maps) {
    return new Promise((resolve) => {
      window.kakao?.maps.load(() => resolve(window.kakao!.maps));
    });
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>("script[data-kakao-map-sdk]");
    if (existingScript) {
      existingScript.addEventListener("load", () => {
        window.kakao?.maps.load(() => resolve(window.kakao!.maps));
      }, { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.dataset.kakaoMapSdk = "true";
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&libraries=services&autoload=false`;
    script.onload = () => {
      window.kakao?.maps.load(() => resolve(window.kakao!.maps));
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function KakaoMapPreview({
  locationText,
  placeLink,
}: {
  locationText: string;
  placeLink: string;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const query = displayLocationText(locationText, placeLink);
  const kakaoSearchUrl = `https://map.kakao.com/link/search/${encodeURIComponent(query)}`;
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY?.trim();

  useEffect(() => {
    let cancelled = false;

    async function renderMap() {
      if (!appKey || !mapRef.current || !query) {
        setStatus("fallback");
        return;
      }

      try {
        const maps = await loadKakaoMaps(appKey);
        if (cancelled || !mapRef.current) return;

        const places = new maps.services.Places();
        places.keywordSearch(query, (data, searchStatus) => {
          if (cancelled || !mapRef.current) return;
          const place = data[0];
          if (searchStatus !== maps.services.Status.OK || !place) {
            setStatus("fallback");
            return;
          }

          const position = new maps.LatLng(Number(place.y), Number(place.x));
          const map = new maps.Map(mapRef.current, { center: position, level: 3 });
          new maps.Marker({ map, position });
          setStatus("ready");
        });
      } catch {
        if (!cancelled) setStatus("fallback");
      }
    }

    void renderMap();

    return () => {
      cancelled = true;
    };
  }, [appKey, query]);

  if (status === "fallback") {
    return (
      <div className="mt-2 grid gap-2 rounded-xl border p-3" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}>
        <p className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
          {query}
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={kakaoSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-press inline-flex h-9 items-center justify-center rounded-full border px-3 text-sm font-bold"
            style={{ borderColor: "rgba(13, 127, 242, 0.25)", backgroundColor: "var(--accent-weak)", color: "var(--accent-strong)" }}
          >
            카카오 지도 검색
          </a>
          <a
            href={placeLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-press inline-flex h-9 items-center justify-center rounded-full border px-3 text-sm font-bold"
            style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)", color: "var(--ink-soft)" }}
          >
            네이버 지도 열기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 overflow-hidden rounded-xl border" style={{ borderColor: "var(--line)" }}>
      <div ref={mapRef} className="h-[280px] w-full" />
      {status === "loading" ? (
        <div className="border-t px-4 py-2 text-xs font-semibold" style={{ borderColor: "var(--line)", color: "var(--ink-muted)" }}>
          지도 로딩중...
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 border-t px-4 py-2" style={{ borderColor: "var(--line)" }}>
          <p className="truncate text-xs font-bold" style={{ color: "var(--ink-muted)" }}>
            {query}
          </p>
          <a
            href={kakaoSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold"
            style={{ color: "var(--accent)" }}
          >
            카카오에서 보기 ↗
          </a>
        </div>
      )}
    </div>
  );
}

export function MapPreview({ provider, embedUrl, locationText, placeLink }: MapPreviewProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (provider === "naver") return;

    timerRef.current = setTimeout(() => {
      setStatus((prev) => (prev === "loading" ? "error" : prev));
    }, IFRAME_LOAD_TIMEOUT_MS);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [provider]);

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

  const isNaver = provider === "naver";
  if (isNaver) {
    return <KakaoMapPreview locationText={locationText} placeLink={placeLink} />;
  }

  if (status === "error") {
    return <MapLinkCard locationText={locationText} placeLink={placeLink} />;
  }

  return (
    <div className="mt-2 w-full">
      <div
        className="relative w-full overflow-hidden rounded-xl border"
        style={{
          aspectRatio: isNaver ? "16/9" : "4/3",
          minHeight: isNaver ? "260px" : "240px",
          maxHeight: isNaver ? "360px" : "320px",
          borderColor: "var(--line)",
        }}
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
          className="absolute"
          style={{
            left: isNaver ? "-86px" : 0,
            top: isNaver ? "-116px" : 0,
            width: isNaver ? "calc(100% + 172px)" : "100%",
            height: isNaver ? "calc(100% + 190px)" : "100%",
            opacity: status === "loaded" ? 1 : 0,
          }}
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
