export function extractHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const urlCandidates = trimmed.match(/https?:\/\/[^\s]+/gi) ?? [trimmed];
  for (const candidate of urlCandidates) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.toString();
      }
    } catch {
      // Ignore invalid URL tokens and keep looking.
    }
  }

  return null;
}

export type MapProvider = "kakao" | "naver" | "google";

export type MapEmbedInfo = {
  provider: MapProvider;
  embedUrl: string;
  lat?: number;
  lng?: number;
} | null;

/**
 * 지도 서비스 URL을 파싱하여 iframe 임베드 정보를 반환합니다.
 * 구글 Maps는 X-Frame-Options 차단 + API 키 필수로 항상 null 반환.
 */
export function extractMapEmbedInfo(url: string): MapEmbedInfo {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const { hostname, pathname } = parsed;

  // 카카오맵 place URL: place.map.kakao.com/{place_id}
  if (hostname === "place.map.kakao.com") {
    return { provider: "kakao", embedUrl: url };
  }

  // 카카오맵 좌표 URL: map.kakao.com/link/map/{name},{lat},{lng}
  if (hostname === "map.kakao.com") {
    const linkMapMatch = pathname.match(/^\/link\/map\/(.+),(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
    if (linkMapMatch) {
      const lat = parseFloat(linkMapMatch[2]);
      const lng = parseFloat(linkMapMatch[3]);
      return { provider: "kakao", embedUrl: url, lat, lng };
    }
    return null;
  }

  // 네이버맵 place URL: map.naver.com/p/entry/place/{id}
  if (hostname === "map.naver.com") {
    if (pathname.startsWith("/p/entry/place/")) {
      return { provider: "naver", embedUrl: url };
    }
    return null;
  }

  // 네이버 단축 URL: naver.me/{short}
  if (hostname === "naver.me") {
    return { provider: "naver", embedUrl: url };
  }

  // 구글맵 — X-Frame-Options 차단 + API 키 필수, 임베드 불가
  if (
    hostname === "www.google.com" ||
    hostname === "google.com" ||
    hostname === "maps.google.com" ||
    hostname === "goo.gl"
  ) {
    return null;
  }

  return null;
}
