"use client";

import { useState } from "react";

type OfflineStudyCaptureButtonProps = {
  targetId: string;
};

type CaptureState = "idle" | "capturing" | "downloaded";
const DEFAULT_CAPTURE_BUTTON_LABEL = "공유 이미지 다운로드";

type Html2CanvasFn = (element: HTMLElement, options?: Record<string, unknown>) => Promise<HTMLCanvasElement>;
type HtmlToImageNamespace = {
  toBlob: (element: HTMLElement, options?: Record<string, unknown>) => Promise<Blob | null>;
};

declare global {
  interface Window {
    html2canvas?: Html2CanvasFn;
    htmlToImage?: HtmlToImageNamespace;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("캡처 이미지를 생성하지 못했습니다."));
    }, "image/png");
  });
}

function triggerPngDownload(pngBlob: Blob): void {
  const blobUrl = URL.createObjectURL(pngBlob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `offline-study-cards-${new Date().toISOString().slice(0, 10)}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

async function loadHtml2CanvasFromCdn(): Promise<Html2CanvasFn> {
  if (window.html2canvas) {
    return window.html2canvas;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("html2canvas 스크립트 로드에 실패했습니다."));
    document.head.appendChild(script);
  });

  if (!window.html2canvas) {
    throw new Error("html2canvas를 불러오지 못했습니다.");
  }

  return window.html2canvas;
}

async function loadHtmlToImageFromCdn(): Promise<HtmlToImageNamespace> {
  if (window.htmlToImage) {
    return window.htmlToImage;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/dist/html-to-image.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("html-to-image 스크립트 로드에 실패했습니다."));
    document.head.appendChild(script);
  });

  if (!window.htmlToImage) {
    throw new Error("html-to-image를 불러오지 못했습니다.");
  }

  return window.htmlToImage;
}

function sanitizeCaptureClone(clonedDocument: Document, clonedTarget: HTMLElement): void {
  const html = clonedDocument.documentElement as HTMLElement;
  const body = clonedDocument.body;

  html.style.setProperty("background-image", "none", "important");
  html.style.setProperty("background-color", "#ffffff", "important");
  body.style.setProperty("background-image", "none", "important");
  body.style.setProperty("background-color", "#ffffff", "important");

  const targetNodes = [clonedTarget, ...Array.from(clonedTarget.querySelectorAll("*"))] as HTMLElement[];
  for (const node of targetNodes) {
    node.style.animation = "none";
    node.style.transition = "none";
    node.style.opacity = "1";
    node.style.setProperty("filter", "none", "important");
    node.style.setProperty("backdrop-filter", "none", "important");
  }

  const clonedWindow = clonedDocument.defaultView;
  if (!clonedWindow) {
    return;
  }

  const allNodes = Array.from(clonedDocument.querySelectorAll("*")) as HTMLElement[];
  for (const node of allNodes) {
    const backgroundImage = clonedWindow.getComputedStyle(node).backgroundImage;
    if (backgroundImage.includes("url(")) {
      node.style.setProperty("background-image", "none", "important");
    }
  }

  normalizeCaptureButtons(clonedTarget);
  normalizeCapturePills(clonedTarget, clonedWindow);
}

async function tryHtml2CanvasPng(element: HTMLElement): Promise<Blob> {
  if ("fonts" in document) {
    await (document as Document & { fonts: FontFaceSet }).fonts.ready;
  }

  const html2canvas = await loadHtml2CanvasFromCdn();
  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: Math.max(2, Math.min(3, window.devicePixelRatio || 1)),
    useCORS: false,
    allowTaint: false,
    foreignObjectRendering: false,
    logging: false,
    onclone: (clonedDocument: Document) => {
      const targetId = element.id;
      const clonedTarget = targetId ? clonedDocument.getElementById(targetId) : null;
      if (!(clonedTarget instanceof HTMLElement)) {
        return;
      }

      sanitizeCaptureClone(clonedDocument, clonedTarget);
    },
  });

  return canvasToBlob(canvas);
}

function normalizeCaptureButtons(root: ParentNode): void {
  const buttons = Array.from(root.querySelectorAll('[data-capture-button="true"]')) as HTMLButtonElement[];
  for (const button of buttons) {
    button.textContent = DEFAULT_CAPTURE_BUTTON_LABEL;
    button.disabled = false;
    button.style.opacity = "1";
  }
}

function normalizeCapturePills(root: ParentNode, clonedWindow: Window): void {
  const pills = Array.from(root.querySelectorAll('[data-capture-pill="true"]')) as HTMLElement[];
  for (const pill of pills) {
    const computed = clonedWindow.getComputedStyle(pill);
    const height = Number.parseFloat(computed.height || "0");
    const minHeight = Number.isFinite(height) && height > 0 ? Math.max(16, Math.round(height)) : 20;

    pill.style.setProperty("display", "inline-flex", "important");
    pill.style.setProperty("align-items", "center", "important");
    pill.style.setProperty("justify-content", "center", "important");
    pill.style.setProperty("vertical-align", "middle", "important");
    pill.style.setProperty("line-height", "1", "important");
    pill.style.setProperty("min-height", `${minHeight}px`, "important");
    pill.style.setProperty("height", "auto", "important");
  }

  const pillTexts = Array.from(root.querySelectorAll('[data-capture-pill-text="true"]')) as HTMLElement[];
  for (const text of pillTexts) {
    text.style.setProperty("display", "inline-flex", "important");
    text.style.setProperty("align-items", "center", "important");
    text.style.setProperty("justify-content", "center", "important");
    text.style.setProperty("vertical-align", "middle", "important");
    text.style.setProperty("line-height", "1", "important");
    text.style.setProperty("transform", "none", "important");
  }
}

function createHiddenCaptureClone(element: HTMLElement): { clone: HTMLElement; cleanup: () => void } {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-100000px";
  host.style.top = "0";
  host.style.pointerEvents = "none";
  host.style.opacity = "1";
  host.style.zIndex = "-1";
  host.style.backgroundColor = "#ffffff";

  const clone = element.cloneNode(true);
  if (!(clone instanceof HTMLElement)) {
    throw new Error("캡처용 복제 노드를 만들지 못했습니다.");
  }
  if (clone.id) {
    clone.id = `${clone.id}-clone`;
  }

  host.appendChild(clone);
  document.body.appendChild(host);

  const targetNodes = [clone, ...Array.from(clone.querySelectorAll("*"))] as HTMLElement[];
  for (const node of targetNodes) {
    node.style.animation = "none";
    node.style.transition = "none";
    node.style.opacity = "1";
    node.style.setProperty("filter", "none", "important");
    node.style.setProperty("backdrop-filter", "none", "important");

    const backgroundImage = window.getComputedStyle(node).backgroundImage;
    if (backgroundImage.includes("url(")) {
      node.style.setProperty("background-image", "none", "important");
    }
  }

  normalizeCaptureButtons(clone);
  normalizeCapturePills(clone, window);

  return {
    clone,
    cleanup: () => {
      host.remove();
    },
  };
}

async function tryHtmlToImagePng(element: HTMLElement): Promise<Blob> {
  if ("fonts" in document) {
    await (document as Document & { fonts: FontFaceSet }).fonts.ready;
  }

  const htmlToImage = await loadHtmlToImageFromCdn();
  const { clone, cleanup } = createHiddenCaptureClone(element);
  try {
    const pngBlob = await htmlToImage.toBlob(clone, {
      cacheBust: true,
      pixelRatio: Math.max(2, Math.min(3, window.devicePixelRatio || 1)),
      backgroundColor: "#ffffff",
    });

    if (!pngBlob) {
      throw new Error("html-to-image가 Blob을 생성하지 못했습니다.");
    }

    return pngBlob;
  } finally {
    cleanup();
  }
}

function openCapturePreviewWindow(target: HTMLElement): boolean {
  const popup = window.open("", "_blank", "noopener,noreferrer,width=1400,height=1000");
  if (!popup) {
    return false;
  }

  const inlineStyleTags = Array.from(document.querySelectorAll("style"))
    .map((node) => node.outerHTML)
    .join("\n");
  const stylesheetLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((node) => `<link rel="stylesheet" href="${(node as HTMLLinkElement).href}" />`)
    .join("\n");
  const stylesheetRules = Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join("\n");
      } catch {
        return "";
      }
    })
    .join("\n");
  const styleMarkup = `${stylesheetLinks}\n${inlineStyleTags}\n<style>${stylesheetRules}</style>`;

  popup.document.open();
  popup.document.write(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <base href="${window.location.origin}${window.location.pathname}" />
  <title>오프라인 스터디 카드 캡처</title>
  ${styleMarkup}
  <style>
    html, body { margin: 0; padding: 0; background: #ffffff !important; }
    body { padding: 24px; }
    #capture-preview-root { width: fit-content; max-width: 100%; }
    #capture-preview-root a { pointer-events: none; }
  </style>
</head>
<body>
  <div id="capture-preview-root"></div>
</body>
</html>`);
  popup.document.close();

  const mount = popup.document.getElementById("capture-preview-root");
  if (!mount) {
    popup.close();
    return false;
  }

  const clonedTarget = popup.document.importNode(target, true);
  if (clonedTarget instanceof HTMLElement && clonedTarget.id) {
    clonedTarget.id = `${clonedTarget.id}-preview`;
  }
  normalizeCaptureButtons(clonedTarget);
  mount.appendChild(clonedTarget);
  popup.focus();

  return true;
}

export function OfflineStudyCaptureButton({ targetId }: OfflineStudyCaptureButtonProps) {
  const [captureState, setCaptureState] = useState<CaptureState>("idle");

  async function handleCapture(): Promise<void> {
    const target = document.getElementById(targetId);
    if (!target) {
      window.alert("캡처할 영역을 찾지 못했습니다.");
      return;
    }

    setCaptureState("capturing");
    try {
      let pngBlob: Blob;
      try {
        pngBlob = await tryHtmlToImagePng(target);
      } catch (htmlToImageError) {
        try {
          pngBlob = await tryHtml2CanvasPng(target);
        } catch (html2CanvasError) {
          const first = htmlToImageError instanceof Error ? htmlToImageError.message : "unknown";
          const second = html2CanvasError instanceof Error ? html2CanvasError.message : "unknown";
          throw new Error(`html-to-image 실패(${first}), html2canvas 실패(${second})`);
        }
      }

      triggerPngDownload(pngBlob);
      setCaptureState("downloaded");
      window.setTimeout(() => setCaptureState("idle"), 1400);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown";
      const opened = openCapturePreviewWindow(target);
      if (opened) {
        window.alert(
          `PNG 자동 다운로드가 실패했습니다.\n원인: ${reason}\n캡처 전용 새 창을 열었습니다. 새 창에서 브라우저 기본 캡처로 공유해 주세요.`
        );
      } else {
        window.alert(`PNG 자동 다운로드가 실패했습니다.\n원인: ${reason}\n팝업 차단을 해제한 뒤 다시 시도해 주세요.`);
      }
      setCaptureState("idle");
    }
  }

  const buttonLabel =
    captureState === "capturing"
      ? "캡처 중..."
      : captureState === "downloaded"
        ? "다운로드 완료"
        : DEFAULT_CAPTURE_BUTTON_LABEL;

  return (
    <button
      type="button"
      onClick={handleCapture}
      disabled={captureState === "capturing"}
      data-capture-button="true"
      className="btn-press inline-flex h-9 items-center rounded-lg border px-3 text-xs font-semibold transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-70"
      style={{ borderColor: "var(--line)", color: "var(--ink-soft)", backgroundColor: "var(--surface)" }}
    >
      {buttonLabel}
    </button>
  );
}
