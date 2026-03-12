export function toKstIsoDate(value: Date): string {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kst = new Date(value.getTime() + KST_OFFSET_MS);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function pickNearestUpcomingIsoDate(
  dates: string[],
  todayIsoDate: string
): string {
  let nearestUpcoming: string | null = null;
  let latestPast: string | null = null;

  for (const date of dates) {
    if (date >= todayIsoDate) {
      if (!nearestUpcoming || date < nearestUpcoming) {
        nearestUpcoming = date;
      }
      continue;
    }

    if (!latestPast || date > latestPast) {
      latestPast = date;
    }
  }

  return nearestUpcoming ?? latestPast ?? todayIsoDate;
}
