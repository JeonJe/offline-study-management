import Link from "next/link";
import { redirect } from "next/navigation";
import { BackLink } from "@/app/back-link";
import { PendingSubmitButton } from "@/app/pending-submit-button";
import { createOperatingUnitAction } from "@/app/admin/operating-units/operating-unit-actions";
import { OPERATING_UNITS_PATH } from "@/app/admin/operating-units/operating-unit-routes";
import { RoleShell } from "@/app/role-shell";
import { isGlobalAuthenticated } from "@/lib/auth";

function createToastMessage(unitStatus?: string): string {
  if (unitStatus === "access-code-required") return "입장 코드를 입력하세요.";
  if (unitStatus === "angel-code-required") return "엔젤 코드를 입력하세요.";
  if (unitStatus === "admin-code-required") return "관리자 코드를 입력하세요.";
  return "";
}

function OperatingUnitForm({ unitStatus }: { unitStatus?: string }) {
  const message = createToastMessage(unitStatus);

  return (
    <div className="grid gap-4">
      <BackLink href={OPERATING_UNITS_PATH}>목록으로</BackLink>
      <form action={createOperatingUnitAction} className="card-static grid gap-4 p-5 sm:p-6">
        {message ? (
          <div
            className="rounded-xl border px-3 py-2 text-sm font-semibold"
            style={{ borderColor: "#fecaca", backgroundColor: "#fef2f2", color: "#991b1b" }}
          >
            {message}
          </div>
        ) : null}

        <div className="grid gap-2">
          <label className="text-sm font-bold" htmlFor="slug" style={{ color: "var(--ink)" }}>
            접속 주소
          </label>
          <input
            id="slug"
            name="slug"
            required
            pattern="[a-z0-9_-]+"
            placeholder="예: loop-pak-4"
            className="h-11 rounded-xl border px-3 text-sm outline-none"
            style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
          />
          <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
            링크에 들어갈 짧은 영문 주소입니다. 예: /cohorts/loop-pak-4/admin
          </p>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-bold" htmlFor="name" style={{ color: "var(--ink)" }}>
            이름
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="예: 루프팩 4기"
            className="h-11 rounded-xl border px-3 text-sm outline-none"
            style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-bold" htmlFor="description" style={{ color: "var(--ink)" }}>
            설명
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            placeholder="예: 2026년 상반기 루프팩 오프라인 수업"
            className="rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-bold" htmlFor="accessPassword" style={{ color: "var(--ink)" }}>
            입장 코드
          </label>
          <input
            id="accessPassword"
            name="accessPassword"
            type="password"
            required
            autoComplete="new-password"
            placeholder="참가자가 첫 화면에서 입력할 코드"
            className="h-11 rounded-xl border px-3 text-sm outline-none"
            style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
          />
          <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
            참가자는 첫 화면에서 이름을 고른 뒤 이 코드로 입장합니다.
          </p>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-bold" htmlFor="angelPassword" style={{ color: "var(--ink)" }}>
            엔젤 코드
          </label>
          <input
            id="angelPassword"
            name="angelPassword"
            type="password"
            required
            autoComplete="new-password"
            placeholder="엔젤 화면을 열 때 입력할 코드"
            className="h-11 rounded-xl border px-3 text-sm outline-none"
            style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
          />
          <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
            엔젤은 이 코드로 주간 보고 화면에 접근합니다.
          </p>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-bold" htmlFor="adminPassword" style={{ color: "var(--ink)" }}>
            관리자 코드
          </label>
          <input
            id="adminPassword"
            name="adminPassword"
            type="password"
            required
            autoComplete="new-password"
            placeholder="관리자 화면을 열 때 입력할 코드"
            className="h-11 rounded-xl border px-3 text-sm outline-none"
            style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
          />
          <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
            기수 관리자는 이 코드로 멤버, 팀, 보고 설정을 관리합니다.
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Link
            href={OPERATING_UNITS_PATH}
            className="rounded-full border px-4 py-2 text-sm font-bold"
            style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
          >
            취소
          </Link>
          <PendingSubmitButton
            idleLabel="생성"
            pendingLabel="생성 중"
            className="btn-press rounded-full px-4 py-2 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-70"
            style={{ backgroundColor: "var(--accent)" }}
          />
        </div>
      </form>
    </div>
  );
}

export default async function NewOperatingUnitPage({
  searchParams,
}: {
  searchParams?: Promise<{ unit?: string }>;
}) {
  const authenticated = await isGlobalAuthenticated();
  if (!authenticated) {
    redirect("/?auth=required");
  }

  const unitStatus = (await searchParams)?.unit;

  return (
    <RoleShell
      activeRole="admin"
      title="새 기수 만들기"
      summary="기수 이름, 접속 주소, 참가자와 운영진 코드를 등록합니다."
      scopeLabel="전체관리자"
      showRoleNav={false}
    >
      <OperatingUnitForm unitStatus={unitStatus} />
    </RoleShell>
  );
}
