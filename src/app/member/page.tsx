import { redirect } from "next/navigation";
import { cohortAwarePath } from "@/lib/cohort-routes";

type MemberPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function MemberPage({ searchParams }: MemberPageProps) {
  const params = await searchParams;
  const unitSlug = singleParam(params.unit);

  if (!unitSlug) {
    redirect("/");
  }

  redirect(cohortAwarePath(unitSlug, "/"));
}
