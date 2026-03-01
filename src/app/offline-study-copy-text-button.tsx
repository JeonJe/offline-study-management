"use client";

import { useState } from "react";

type OfflineStudyCopyTextButtonProps = {
  textToCopy: string;
};

type CopyState = "idle" | "copying" | "copied" | "failed";

async function writeTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-100000px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const success = document.execCommand("copy");
  textarea.remove();
  if (!success) {
    throw new Error("execCommand copy failed");
  }
}

export function OfflineStudyCopyTextButton({ textToCopy }: OfflineStudyCopyTextButtonProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  async function handleCopy(): Promise<void> {
    if (!textToCopy.trim()) {
      window.alert("복사할 텍스트가 없습니다.");
      return;
    }

    setCopyState("copying");
    try {
      await writeTextToClipboard(textToCopy);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1400);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 1800);
      window.alert("클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.");
    }
  }

  const buttonLabel =
    copyState === "copying"
      ? "복사 중..."
      : copyState === "copied"
        ? "복사 완료"
        : copyState === "failed"
          ? "복사 실패"
          : "텍스트 복사";

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={copyState === "copying"}
      className="btn-press inline-flex h-9 items-center rounded-lg border px-3 text-xs font-semibold transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-70"
      style={{ borderColor: "var(--line)", color: "var(--ink-soft)", backgroundColor: "var(--surface)" }}
      data-share-text-button="true"
    >
      {buttonLabel}
    </button>
  );
}
