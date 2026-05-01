export type ShareUrlResult = "shared" | "copied" | "aborted";

type ShareUrlOptions = {
  path: string;
  origin: string;
  share?: (payload: { url: string }) => Promise<void>;
  copy?: (text: string) => Promise<void>;
};

export function resolveShareOrigin(fallbackOrigin: string): string {
  const configuredOrigin = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (!configuredOrigin) return fallbackOrigin;

  try {
    const parsed = new URL(configuredOrigin);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.origin;
    }
  } catch {
    return fallbackOrigin;
  }

  return fallbackOrigin;
}

export function buildShareUrl(path: string, fallbackOrigin: string): string {
  return new URL(path, resolveShareOrigin(fallbackOrigin)).toString();
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }

  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "AbortError"
  );
}

export async function shareOrCopyUrl({
  path,
  origin,
  share,
  copy,
}: ShareUrlOptions): Promise<ShareUrlResult> {
  const url = buildShareUrl(path, origin);

  if (share) {
    try {
      await share({ url });
      return "shared";
    } catch (error) {
      if (isAbortError(error)) {
        return "aborted";
      }
      if (!copy) {
        throw error;
      }
      await copy(url);
      return "copied";
    }
  }

  if (copy) {
    await copy(url);
    return "copied";
  }

  throw new Error("이 브라우저는 링크 공유를 지원하지 않습니다.");
}
