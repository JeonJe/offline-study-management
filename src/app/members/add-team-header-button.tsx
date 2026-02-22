"use client";

export function AddTeamHeaderButton() {
  return (
    <button
      type="button"
      className="btn-press rounded-xl px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
      style={{ backgroundColor: "var(--accent)" }}
      onClick={() => window.dispatchEvent(new Event("members:add-team"))}
    >
      팀 추가
    </button>
  );
}
