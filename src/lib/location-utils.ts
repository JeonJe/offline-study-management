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
