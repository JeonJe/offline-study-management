import { describe, expect, it, vi } from "vitest";
import { shareOrCopyUrl } from "@/lib/share-url";

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
});
