import Link from "next/link";
import { loginRoleAction } from "@/app/role-actions";
import {
  type RolePageDefinition,
  type RolePageRole,
} from "@/lib/role-page";

export function RoleHome({ page }: { page: RolePageDefinition }) {
  return (
    <div className="grid gap-5">
      <section className="card-static p-5 sm:p-7">
        <span
          className="inline-flex rounded-full border px-3 py-1 text-xs font-bold"
          style={{
            borderColor: "rgba(13, 127, 242, 0.25)",
            backgroundColor: "var(--accent-weak)",
            color: "var(--accent-strong)",
          }}
        >
          {page.badge}
        </span>
        <h2 className="mt-4 text-2xl font-extrabold" style={{ color: "var(--ink)" }}>
          {page.title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
          {page.summary}
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {page.sections.map((section) => (
          <article key={section.title} className="card-static p-5 sm:p-6">
            <h3 className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>
              {section.title}
            </h3>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
              {section.description}
            </p>
            <div className="mt-5 grid gap-3">
              {section.links.map((link) => (
                <Link
                  key={`${section.title}-${link.href}-${link.label}`}
                  href={link.href}
                  className="rounded-2xl border p-4 transition hover:opacity-85"
                  style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
                >
                  <span className="text-sm font-bold" style={{ color: "var(--ink)" }}>
                    {link.label}
                  </span>
                  <span className="mt-1 block text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
                    {link.description}
                  </span>
                </Link>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

export function RoleAccessRequired({
  role,
  label,
  invalid,
  returnPath,
}: {
  role: Exclude<RolePageRole, "member">;
  label: string;
  invalid: boolean;
  returnPath?: string;
}) {
  return (
    <section className="flex min-h-[52vh] w-full items-center justify-center py-8">
      <div className="card-static w-full max-w-[420px] p-5 sm:p-7">
        <h2 className="text-2xl font-extrabold" style={{ color: "var(--ink)" }}>
          {label} 비밀번호
        </h2>
        <p className="mt-2 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
          전용 화면을 열려면 비밀번호를 입력하세요.
        </p>

        <form action={loginRoleAction} className="mt-5 grid gap-3">
          <input type="hidden" name="role" value={role} />
          {returnPath ? <input type="hidden" name="returnPath" value={returnPath} /> : null}
          <label className="grid gap-2 text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
            비밀번호
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              autoFocus
              className="h-12 rounded-xl border px-3 text-base"
              style={{ borderColor: invalid ? "var(--danger)" : "var(--line)", color: "var(--ink)" }}
            />
          </label>
          {invalid ? (
            <p className="text-sm font-semibold" style={{ color: "var(--danger)" }}>
              비밀번호가 맞지 않습니다.
            </p>
          ) : null}
          <button
            type="submit"
            className="btn-press h-12 rounded-full px-4 text-sm font-bold text-white"
            style={{ backgroundColor: "var(--accent)" }}
          >
            열기
          </button>
        </form>
      </div>
    </section>
  );
}

export function RoleNotConfigured({ label }: { label: string }) {
  return (
    <section className="flex min-h-[52vh] w-full items-center justify-center py-8">
      <div className="card-static w-full max-w-[460px] p-5 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--danger)" }}>
        설정 필요
      </p>
      <h2 className="mt-2 text-2xl font-extrabold" style={{ color: "var(--ink)" }}>
        {label} 비밀번호가 없습니다
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
        개발 환경에 전용 비밀번호를 추가하면 이 화면을 열 수 있습니다.
      </p>
      <Link
        href="/"
        className="btn-press mt-5 inline-flex rounded-full border px-3.5 py-2 text-sm font-semibold"
        style={{
          borderColor: "rgba(13, 127, 242, 0.35)",
          color: "var(--accent-strong)",
          backgroundColor: "var(--accent-weak)",
        }}
      >
        오프라인 모임
      </Link>
      </div>
    </section>
  );
}
