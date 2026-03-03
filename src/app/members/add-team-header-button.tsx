"use client";

export function AddTeamHeaderButton() {
  return (
    <button
      type="button"
      className="btn-press rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
      style={{ backgroundColor: "var(--accent)", boxShadow: "0 8px 20px rgba(13, 127, 242, 0.26)" }}
      onClick={() => window.dispatchEvent(new Event("members:add-team"))}
    >
      팀 추가
    </button>
  );
}
