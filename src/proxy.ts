import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveCohortRewrite } from "@/lib/cohort-routes";

export function proxy(request: NextRequest) {
  const rewrite = resolveCohortRewrite(request.nextUrl.pathname);
  if (!rewrite) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = rewrite.pathname;
  if (!url.searchParams.has("unit")) {
    url.searchParams.set("unit", rewrite.unitSlug);
  }

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/cohorts/:path*"],
};
