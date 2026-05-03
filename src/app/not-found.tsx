import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 sm:px-6">
      <section className="app-section w-full p-6 sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em]" style={{ color: "var(--accent-strong)" }}>
          404
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight" style={{ color: "var(--ink)" }}>
          페이지를 찾을 수 없습니다
        </h1>
        <p className="mt-3 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
          주소가 잘못되었거나, 선택한 목록 안에서만 열 수 있는 화면입니다. 첫 화면에서 목록을 다시 선택해주세요.
        </p>
        <Link
          href="/"
          className="btn-press mt-6 inline-flex rounded-lg px-4 py-2.5 text-sm font-bold text-white"
          style={{ backgroundColor: "var(--accent)" }}
        >
          첫 화면으로 가기
        </Link>
      </section>
    </main>
  );
}
