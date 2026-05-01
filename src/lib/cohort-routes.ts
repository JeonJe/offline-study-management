const COHORT_PREFIX = "cohorts";

const ROUTE_MAP: Record<string, string> = {
  "loop-pak": "/loop-pak",
  study: "/",
  afterparty: "/afterparty",
  members: "/members",
  member: "/member",
  angel: "/angel",
  admin: "/admin",
};

export type CohortRewriteTarget = {
  pathname: string;
  unitSlug: string;
};

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function cleanSegments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

export function cohortScopedPath(unitSlug: string, section: string = "loop-pak"): string {
  const unit = unitSlug.trim();
  const normalizedSection = section.trim() || "loop-pak";
  if (!unit) return "/";
  return `/${COHORT_PREFIX}/${encodeURIComponent(unit)}/${encodeURIComponent(normalizedSection)}`;
}

export function resolveCohortRewrite(pathname: string): CohortRewriteTarget | null {
  const [prefix, rawUnit, rawSection = "loop-pak", ...rest] = cleanSegments(pathname);
  if (prefix !== COHORT_PREFIX || !rawUnit) return null;

  const section = safeDecode(rawSection);
  const targetBase = ROUTE_MAP[section];
  if (!targetBase) return null;

  const restPath = rest.map((segment) => `/${segment}`).join("");
  return {
    pathname: targetBase === "/" ? "/" : `${targetBase}${restPath}`,
    unitSlug: safeDecode(rawUnit),
  };
}
