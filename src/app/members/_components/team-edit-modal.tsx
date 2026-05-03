"use client";

type TeamEditModalProps = {
  open: boolean;
  fixedAngels: string[];
  teamName: string;
  teamAngels: string[];
  teamAngelInput: string;
  onTeamNameChange: (value: string) => void;
  onTeamAngelsChange: (value: string[]) => void;
  onTeamAngelInputChange: (value: string) => void;
  onAddAngel: () => void;
  onCancel: () => void;
  onSubmit: () => void;
};

function RemoveChipButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[11px] leading-none transition hover:bg-black/10"
    >
      ×
    </button>
  );
}

export function TeamEditModal({
  open,
  fixedAngels,
  teamName,
  teamAngels,
  teamAngelInput,
  onTeamNameChange,
  onTeamAngelsChange,
  onTeamAngelInputChange,
  onAddAngel,
  onCancel,
  onSubmit,
}: TeamEditModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-edit-modal-title"
        className="modal-surface w-full max-w-md p-5"
      >
        <h4 id="team-edit-modal-title" className="text-base font-semibold" style={{ color: "var(--ink)" }}>
          팀 수정
        </h4>
        <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
          팀 이름과 담당 엔젤을 수정합니다. 엔젤은 최대 2명까지 등록됩니다.
        </p>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
            팀 이름
            <input
              value={teamName}
              onChange={(event) => onTeamNameChange(event.target.value)}
              className="h-10 rounded-xl border bg-white px-3 text-sm"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              placeholder="예: 1팀"
              autoFocus
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
            담당 엔젤
            <div className="rounded-xl border p-2" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}>
              <div className="flex flex-wrap gap-2">
                {teamAngels.length > 0 ? (
                  teamAngels.map((angel) => (
                    <span
                      key={`team-edit-angel-${angel}`}
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs"
                      style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)", color: "var(--ink-soft)" }}
                    >
                      {angel}
                      <RemoveChipButton
                        label={`${angel} 담당 엔젤 제거`}
                        onClick={() => onTeamAngelsChange(teamAngels.filter((name) => name !== angel))}
                      />
                    </span>
                  ))
                ) : (
                  <span className="py-1 text-xs" style={{ color: "var(--ink-muted)" }}>
                    담당 엔젤을 선택해주세요.
                  </span>
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <select
                  value={teamAngelInput}
                  onChange={(event) => onTeamAngelInputChange(event.target.value)}
                  className="h-10 min-w-0 flex-1 rounded-xl border bg-white px-3 text-sm"
                  style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                  disabled={teamAngels.length >= 2}
                >
                  <option value="">엔젤 선택</option>
                  {fixedAngels
                    .filter((angel) => !teamAngels.includes(angel))
                    .map((angel) => (
                      <option key={`team-edit-angel-option-${angel}`} value={angel}>
                        {angel}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={!teamAngelInput || teamAngels.length >= 2}
                  className="btn-press h-10 rounded-xl border px-3 text-xs font-semibold disabled:cursor-not-allowed"
                  style={{
                    borderColor: "rgba(13, 127, 242, 0.25)",
                    backgroundColor: "var(--accent-weak)",
                    color: "var(--accent-strong)",
                    opacity: teamAngelInput && teamAngels.length < 2 ? 1 : 0.45,
                  }}
                  onClick={onAddAngel}
                >
                  추가
                </button>
              </div>
            </div>
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
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
            className="btn-press rounded-xl px-3 py-2 text-xs font-semibold text-white"
            style={{ backgroundColor: "var(--accent)" }}
            onClick={onSubmit}
          >
            수정
          </button>
        </div>
      </div>
    </div>
  );
}
