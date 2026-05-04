import { BackLink } from "@/app/back-link";
import {
  getOperatingUnit,
  type OperatingUnit,
} from "@/lib/operating-unit-store";
import {
  OPERATING_UNITS_PATH,
  operatingUnitDetailPath,
} from "@/app/admin/operating-units/operating-unit-routes";

export function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export async function safeGetOperatingUnit(slug: string): Promise<{
  unit: OperatingUnit | null;
  error: boolean;
}> {
  try {
    return { unit: await getOperatingUnit(slug), error: false };
  } catch (error) {
    console.error("[operating-units] getOperatingUnit 실패:", error);
    return { unit: null, error: true };
  }
}

export function OperatingUnitLoadError() {
  return (
    <section className="card-static p-5 text-sm" style={{ color: "var(--ink-muted)" }}>
      데이터를 불러오지 못했습니다.
    </section>
  );
}

export function OperatingUnitNotFound() {
  return (
    <section className="card-static p-5 text-sm" style={{ color: "var(--ink-muted)" }}>
      항목을 찾을 수 없습니다.
    </section>
  );
}

export function BackToOperatingUnitsLink() {
  return (
    <BackLink href={OPERATING_UNITS_PATH}>목록으로</BackLink>
  );
}

export function BackToOperatingUnitDetailLink({ unit }: { unit: OperatingUnit }) {
  return (
    <BackLink href={operatingUnitDetailPath(unit.slug)}>상세로</BackLink>
  );
}

export function codeDisplayText(currentCode: string | null, hasCode: boolean): string {
  return currentCode ?? (hasCode ? "확인 불가" : "미설정");
}
