import { describe, expect, it } from "vitest";
import { extractHttpUrl } from "@/lib/location-utils";

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
