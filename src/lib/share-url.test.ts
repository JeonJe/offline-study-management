import { afterEach, describe, expect, it, vi } from "vitest";
import { buildShareUrl, resolveShareOrigin, shareOrCopyUrl } from "@/lib/share-url";

const originalPublicBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

afterEach(() => {
  if (originalPublicBaseUrl === undefined) {
    delete process.env.NEXT_PUBLIC_BASE_URL;
  } else {
    process.env.NEXT_PUBLIC_BASE_URL = originalPublicBaseUrl;
  }
});

describe("shareOrCopyUrl", () => {
  it("uses native share when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const copy = vi.fn().mockResolvedValue(undefined);

    const result = await shareOrCopyUrl({
      path: "/meetings/m-1?date=2026-02-26",
      origin: "https://example.com",
      share,
      copy,
    });

    expect(result).toBe("shared");
    expect(share).toHaveBeenCalledWith({
      url: "https://example.com/meetings/m-1?date=2026-02-26",
    });
    expect(copy).not.toHaveBeenCalled();
  });

  it("falls back to clipboard when share fails", async () => {
    const share = vi.fn().mockRejectedValue(new Error("share failed"));
    const copy = vi.fn().mockResolvedValue(undefined);

    const result = await shareOrCopyUrl({
      path: "/afterparty/a-1",
      origin: "https://example.com",
      share,
      copy,
    });

    expect(result).toBe("copied");
    expect(copy).toHaveBeenCalledWith("https://example.com/afterparty/a-1");
  });

  it("returns aborted when user cancels native share", async () => {
    const abortError = new DOMException("cancelled", "AbortError");
    const share = vi.fn().mockRejectedValue(abortError);
    const copy = vi.fn().mockResolvedValue(undefined);

    const result = await shareOrCopyUrl({
      path: "/afterparty/a-1",
      origin: "https://example.com",
      share,
      copy,
    });

    expect(result).toBe("aborted");
    expect(copy).not.toHaveBeenCalled();
  });

  it("uses clipboard when native share is unavailable", async () => {
    const copy = vi.fn().mockResolvedValue(undefined);

    const result = await shareOrCopyUrl({
      path: "/meetings/m-2",
      origin: "https://example.com",
      copy,
    });

    expect(result).toBe("copied");
    expect(copy).toHaveBeenCalledWith("https://example.com/meetings/m-2");
  });

  it("throws when no share capability exists", async () => {
    await expect(
      shareOrCopyUrl({
        path: "/meetings/m-3",
        origin: "https://example.com",
      })
    ).rejects.toThrow("이 브라우저는 링크 공유를 지원하지 않습니다.");
  });

  it("uses NEXT_PUBLIC_BASE_URL when configured", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://offline-study-management.vercel.app";

    expect(resolveShareOrigin("https://preview.vercel.app")).toBe(
      "https://offline-study-management.vercel.app"
    );
    expect(buildShareUrl("/meetings/m-4?date=2026-05-01", "https://preview.vercel.app")).toBe(
      "https://offline-study-management.vercel.app/meetings/m-4?date=2026-05-01"
    );
  });

  it("falls back to runtime origin when NEXT_PUBLIC_BASE_URL is invalid", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "not-a-url";

    expect(buildShareUrl("/meetings/m-5", "https://preview.vercel.app")).toBe(
      "https://preview.vercel.app/meetings/m-5"
    );
  });
});
