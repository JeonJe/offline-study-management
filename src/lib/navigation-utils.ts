export function withSettlementInPath(
  returnPath: string | null,
  afterpartyId: string,
  settlementId: string,
  date?: string
): string {
  const fallbackParams = new URLSearchParams();
  if (date?.trim()) fallbackParams.set("date", date.trim());
  fallbackParams.set("settlement", settlementId);
  const fallbackQuery = fallbackParams.toString();
  const fallbackPath = `/afterparty/${afterpartyId}${fallbackQuery ? `?${fallbackQuery}` : ""}`;

  if (!returnPath) {
    return fallbackPath;
  }

  try {
    const parsed = new URL(returnPath, "http://localhost");
    parsed.searchParams.set("settlement", settlementId);
    const query = parsed.searchParams.toString();
    return `${parsed.pathname}${query ? `?${query}` : ""}${parsed.hash}`;
  } catch {
    return fallbackPath;
  }
}
