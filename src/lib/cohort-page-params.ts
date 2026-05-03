type SearchParams = Record<string, string | string[] | undefined>;

export async function withUnitSearchParams(
  searchParams: Promise<SearchParams>,
  unit: string
): Promise<SearchParams> {
  const params = await searchParams;
  return {
    ...params,
    unit: decodeURIComponent(unit),
  };
}
