import { redirect } from "next/navigation";
import Link from "next/link";
import {
  OPERATING_UNITS_PATH,
  operatingUnitDetailPath,
} from "@/app/admin/operating-units/operating-unit-routes";
import { RoleShell } from "@/app/role-shell";
import { ToastNotice } from "@/app/toast-notice";
import { isGlobalAuthenticated } from "@/lib/auth";
import { type OperatingUnit, listOperatingUnits } from "@/lib/operating-unit-store";
import { codeDisplayText, singleParam } from "@/app/admin/operating-units/operating-unit-page-utils";

async function safeListOperatingUnits(): Promise<{ units: OperatingUnit[]; error: boolean }> {
  try {
    const units = await listOperatingUnits();
    return { units, error: false };
  } catch (err) {
    console.error("[operating-units] listOperatingUnits 실패:", err);
    return { units: [], error: true };
  }
}

function OperatingUnitsPanel({
  units,
  error,
  status,
}: {
  units: OperatingUnit[];
  error: boolean;
  status: string;
}) {
  if (error) {
    return (
      <div className="card-static p-5 text-sm" style={{ color: "var(--ink-muted)" }}>
        데이터를 불러오지 못했습니다.
      </div>
    );
  }

  if (units.length === 0) {
    return (
      <div className="card-static p-5 text-sm" style={{ color: "var(--ink-muted)" }}>
        항목이 없습니다.
      </div>
    );
  }

  const toastMessage =
    status === "created"
      ? "생성 완료"
      : status === "updated"
        ? "수정 완료"
        : status === "deleted"
          ? "삭제 완료"
        : "";

  return (
    <section className="grid gap-4">
      {toastMessage ? <ToastNotice message={toastMessage} /> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold" style={{ color: "var(--ink)" }}>
            기수 목록
          </h2>
          <p className="mt-1 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
            기수 이름, 접속 주소, 참가자 입장 코드를 관리합니다.
          </p>
        </div>
        <Link
          href={`${OPERATING_UNITS_PATH}/new`}
          className="btn-press rounded-full px-4 py-2 text-sm font-bold text-white"
          style={{ backgroundColor: "var(--accent)" }}
        >
          새 기수 만들기
        </Link>
      </div>

      <section className="card-static overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <th
                className="px-5 py-3 text-left font-bold"
                style={{ color: "var(--ink-muted)" }}
              >
                접속 주소
              </th>
              <th
                className="px-5 py-3 text-left font-bold"
                style={{ color: "var(--ink-muted)" }}
              >
                이름
              </th>
              <th
                className="px-5 py-3 text-left font-bold"
                style={{ color: "var(--ink-muted)" }}
              >
                입장 코드
              </th>
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <OperatingUnitRow key={unit.slug} unit={unit} />
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}

function OperatingUnitRow({ unit }: { unit: OperatingUnit }) {
  const detailPath = operatingUnitDetailPath(unit.slug);
  const linkClassName = "block px-5 py-3";

  return (
    <tr
      className="cursor-pointer transition-colors hover:bg-[color:var(--surface-alt)]"
      style={{ borderBottom: "1px solid var(--line)" }}
    >
      <td className="font-mono text-xs" style={{ color: "var(--ink-soft)" }}>
        <Link href={detailPath} className={linkClassName} aria-label={`${unit.name} 상세 보기`}>
          {unit.slug}
        </Link>
      </td>
      <td className="font-bold" style={{ color: "var(--ink)" }}>
        <Link href={detailPath} className={linkClassName}>
          {unit.name}
          {unit.isDefault ? (
            <span
              className="ml-2 rounded-full border px-2 py-0.5 text-[11px] font-bold"
              style={{
                borderColor: "rgba(13, 127, 242, 0.25)",
                backgroundColor: "var(--accent-weak)",
                color: "var(--accent-strong)",
              }}
            >
              기본
            </span>
          ) : null}
        </Link>
      </td>
      <td className="font-mono text-xs" style={{ color: "var(--ink-soft)" }}>
        <Link href={detailPath} className={linkClassName}>
          {unit.accessPassword ? unit.accessPassword : (
            <span style={{ color: "var(--ink-muted)" }}>
              {codeDisplayText(unit.accessPassword, unit.hasAccessPassword)}
            </span>
          )}
        </Link>
      </td>
    </tr>
  );
}

export default async function OperatingUnitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const authenticated = await isGlobalAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const query = await searchParams;
  const { units, error } = await safeListOperatingUnits();

  return (
    <RoleShell
      activeRole="admin"
      title="기수 관리"
      summary="기수 이름, 접속 주소, 참가자 입장 코드를 관리합니다."
      scopeLabel="전체관리자"
      showRoleNav={false}
    >
      <OperatingUnitsPanel units={units} error={error} status={singleParam(query?.unit)} />
    </RoleShell>
  );
}
