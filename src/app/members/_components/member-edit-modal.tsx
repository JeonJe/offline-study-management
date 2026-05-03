"use client";

type MemberEditModalProps = {
  open: boolean;
  memberName: string;
  canSubmit: boolean;
  onMemberNameChange: (value: string) => void;
  onCancel: () => void;
  onDelete: () => void;
  onSubmit: () => void;
};

export function MemberEditModal({
  open,
  memberName,
  canSubmit,
  onMemberNameChange,
  onCancel,
  onDelete,
  onSubmit,
}: MemberEditModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-edit-modal-title"
        className="modal-surface w-full max-w-md p-5"
      >
        <h4 id="member-edit-modal-title" className="text-base font-semibold" style={{ color: "var(--ink)" }}>
          멤버 수정
        </h4>
        <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
          이름을 수정하거나 명단에서 제거합니다.
        </p>

        <label className="mt-4 grid gap-1 text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
          이름
          <input
            value={memberName}
            onChange={(event) => onMemberNameChange(event.target.value)}
            className="h-10 rounded-xl border bg-white px-3 text-sm"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            placeholder="멤버 이름"
            autoFocus
          />
        </label>

        <div className="mt-4 flex flex-wrap justify-between gap-2">
          <button
            type="button"
            className="btn-press rounded-xl border px-3 py-2 text-xs font-semibold"
            style={{ borderColor: "#fecaca", color: "var(--danger)", backgroundColor: "var(--danger-bg)" }}
            onClick={onDelete}
          >
            명단에서 제거
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-press rounded-xl border bg-white px-3 py-2 text-xs font-semibold"
              style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
              onClick={onCancel}
            >
              취소
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              className="btn-press rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--accent)", opacity: canSubmit ? 1 : 0.45 }}
              onClick={onSubmit}
            >
              수정
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
