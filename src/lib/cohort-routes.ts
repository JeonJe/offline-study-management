const COHORT_PREFIX = "cohorts";

const ROUTE_MAP: Record<string, string> = {
  "loop-pak": "/loop-pak",
  study: "/",
  afterparty: "/afterparty",
  meetings: "/meetings",
  members: "/members",
  member: "/member",
  angel: "/angel",
  admin: "/admin",
};

const PATH_SECTION_MAP: { path: string; section: string }[] = [
  { path: "/loop-pak", section: "loop-pak" },
  { path: "/afterparty", section: "afterparty" },
  { path: "/meetings", section: "meetings" },
  { path: "/members", section: "members" },
  { path: "/member", section: "member" },
  { path: "/angel", section: "angel" },
  { path: "/admin", section: "admin" },
  { path: "/", section: "study" },
];

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

export function cohortAwarePath(unitSlug: string, href: string): string {
  const unit = unitSlug.trim();
  if (!unit || !href.startsWith("/") || href.startsWith(`/${COHORT_PREFIX}/`)) return href;

  const parsed = new URL(href, "http://localhost");
  const match = PATH_SECTION_MAP.find(({ path }) => (
    path === "/" ? parsed.pathname === "/" : parsed.pathname === path || parsed.pathname.startsWith(`${path}/`)
  ));
  if (!match) return href;

  const restPath =
    match.path === "/"
      ? ""
      : parsed.pathname.slice(match.path.length).split("/").filter(Boolean).map(encodeURIComponent).join("/");
  const base = cohortScopedPath(unit, match.section);
  const path = restPath ? `${base}/${restPath}` : base;

  return `${path}${parsed.search}${parsed.hash}`;
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
