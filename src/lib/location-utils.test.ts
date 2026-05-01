import { describe, expect, it } from "vitest";
import { extractHttpUrl, extractMapEmbedInfo } from "@/lib/location-utils";

describe("extractHttpUrl", () => {
  it("returns null for empty text", () => {
    expect(extractHttpUrl("")).toBeNull();
    expect(extractHttpUrl("   ")).toBeNull();
  });

  it("extracts url from mixed location text", () => {
    expect(
      extractHttpUrl("강남역 10번 출구 https://map.naver.com/p/entry/place/144")
    ).toBe("https://map.naver.com/p/entry/place/144");
  });

  it("accepts standalone url string", () => {
    expect(extractHttpUrl("https://example.com/path")).toBe("https://example.com/path");
  });

  it("returns null when text does not contain a valid http url", () => {
    expect(extractHttpUrl("map.naver.com/place/1")).toBeNull();
  });
});

describe("extractMapEmbedInfo", () => {
  it("카카오맵 place URL을 파싱한다", () => {
    const result = extractMapEmbedInfo("https://place.map.kakao.com/17733101");
    expect(result).toEqual({
      provider: "kakao",
      embedUrl: "https://place.map.kakao.com/17733101",
    });
  });

  it("카카오맵 좌표 URL에서 lat/lng를 추출한다", () => {
    const result = extractMapEmbedInfo(
      "https://map.kakao.com/link/map/강남역,37.497942,127.027621"
    );
    expect(result).toEqual({
      provider: "kakao",
      embedUrl: "https://map.kakao.com/link/map/강남역,37.497942,127.027621",
      lat: 37.497942,
      lng: 127.027621,
    });
  });

  it("네이버맵 place URL을 파싱한다", () => {
    const result = extractMapEmbedInfo(
      "https://map.naver.com/p/entry/place/1234567890"
    );
    expect(result).toEqual({
      provider: "naver",
      embedUrl: "https://map.naver.com/p/entry/place/1234567890",
    });
  });

  it("네이버 단축 URL을 파싱한다", () => {
    const result = extractMapEmbedInfo("https://naver.me/abc123");
    expect(result).toEqual({
      provider: "naver",
      embedUrl: "https://naver.me/abc123",
    });
  });

  it("구글맵 URL은 null을 반환한다 (X-Frame-Options 차단)", () => {
    expect(
      extractMapEmbedInfo(
        "https://www.google.com/maps/place/강남역/@37.4979,127.0276,17z"
      )
    ).toBeNull();
  });

  it("구글 단축 URL은 null을 반환한다", () => {
    expect(extractMapEmbedInfo("https://goo.gl/maps/abc123")).toBeNull();
  });

  it("지도 서비스가 아닌 URL은 null을 반환한다", () => {
    expect(extractMapEmbedInfo("https://example.com/not-a-map")).toBeNull();
  });

  it("빈 문자열은 null을 반환한다", () => {
    expect(extractMapEmbedInfo("")).toBeNull();
  });

  it("유효하지 않은 URL은 null을 반환한다", () => {
    expect(extractMapEmbedInfo("not-a-url")).toBeNull();
  });

  it("카카오 place URL에는 lat/lng가 없다", () => {
    const result = extractMapEmbedInfo("https://place.map.kakao.com/17733101");
    expect(result?.lat).toBeUndefined();
    expect(result?.lng).toBeUndefined();
  });
});
