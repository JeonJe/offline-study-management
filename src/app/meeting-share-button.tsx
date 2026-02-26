"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { shareOrCopyUrl } from "@/lib/share-url";

type MeetingShareButtonProps = {
  path: string;
  className?: string;
  style?: CSSProperties;
};

type ShareState = "idle" | "sharing" | "copied";

export function MeetingShareButton({ path, className, style }: MeetingShareButtonProps) {
  const [shareState, setShareState] = useState<ShareState>("idle");

  async function handleShare(): Promise<void> {
    setShareState("sharing");
    try {
      const result = await shareOrCopyUrl({
        path,
        origin: window.location.origin,
        share: navigator.share ? (payload) => navigator.share(payload) : undefined,
        copy: navigator.clipboard?.writeText
          ? (text) => navigator.clipboard.writeText(text)
          : undefined,
      });

      if (result === "aborted") {
        setShareState("idle");
        return;
      }

      setShareState("copied");
      window.setTimeout(() => setShareState("idle"), 1200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "링크 공유에 실패했습니다.";
      window.alert(message);
      setShareState("idle");
    }
  }

  const label =
    shareState === "sharing"
      ? "공유 중..."
      : shareState === "copied"
        ? "공유됨"
        : "카드 링크";

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={shareState === "sharing"}
      className={className}
      style={style}
    >
      {label}
    </button>
  );
}
