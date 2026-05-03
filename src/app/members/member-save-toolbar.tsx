type SaveState = "idle" | "saved" | "error";

type MemberSaveToolbarProps = {
  teamCount: number;
  memberCount: number;
  canSave: boolean;
  saving: boolean;
  saveState: SaveState;
  onAddTeam: () => void;
  onSave: () => void;
};

export function MemberSaveToolbar({
  teamCount,
  memberCount,
  canSave,
  saving,
  saveState,
  onAddTeam,
  onSave,
}: MemberSaveToolbarProps) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>멤버 명단</p>
            <span
              className="rounded-full border px-2 py-1 text-xs font-semibold"
              style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)", color: "var(--ink-soft)" }}
            >
              {teamCount}팀 / {memberCount}명
            </span>
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
            팀별 참석/뒷풀이 집계에 사용하는 기본 명단입니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-press rounded-full border px-4 py-2 text-sm font-semibold transition"
            style={{ borderColor: "rgba(13, 127, 242, 0.25)", backgroundColor: "var(--accent-weak)", color: "var(--accent-strong)" }}
            onClick={onAddTeam}
          >
            팀 추가
          </button>
          <button
            type="button"
            disabled={!canSave || saving}
            className="btn-press rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--accent)", boxShadow: "0 8px 20px rgba(13, 127, 242, 0.26)", opacity: canSave && !saving ? 1 : 0.45 }}
            onClick={onSave}
          >
            {saving ? "저장 중" : "저장"}
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
        {!canSave ? (
          <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: "var(--angel-bg)", color: "var(--angel)" }}>
            팀명/팀 엔젤 입력 필요
          </span>
        ) : null}
        {saveState === "saved" ? (
          <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: "var(--success-bg)", color: "var(--success)" }}>
            저장 완료
          </span>
        ) : null}
        {saveState === "error" ? (
          <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger)" }}>
            저장 실패
          </span>
        ) : null}
      </div>
    </>
  );
}
