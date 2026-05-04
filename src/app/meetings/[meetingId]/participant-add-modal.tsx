"use client";

import {
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { bulkCreateRsvpsAction } from "@/app/actions";
import { PendingSubmitButton } from "@/app/pending-submit-button";

type ParticipantAddFeedback = {
  title: string;
  description: string;
  tone: "error" | "notice";
};

type ParticipantAddModalProps = {
  meetingId: string;
  returnDate: string;
  returnPath: string;
  defaultNames?: string;
  feedback?: ParticipantAddFeedback | null;
};

export function ParticipantAddModal({
  meetingId,
  returnDate,
  returnPath,
  defaultNames = "",
  feedback = null,
}: ParticipantAddModalProps) {
  const [open, setOpen] = useState(Boolean(feedback || defaultNames));
  const portalTarget = typeof document === "undefined" ? null : document.body;

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function closeModal(): void {
    setOpen(false);
  }

  function onBackdropClick(event: MouseEvent<HTMLDivElement>): void {
    if (event.target === event.currentTarget) closeModal();
  }

  function onContainerKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") closeModal();
  }

  const feedbackPalette =
    feedback?.tone === "error"
      ? { borderColor: "#fecaca", backgroundColor: "#fff1f2", color: "#be123c" }
      : { borderColor: "#bfdbfe", backgroundColor: "#eff6ff", color: "var(--accent-strong)" };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-press inline-flex h-9 items-center rounded-lg px-3 text-xs font-bold text-white"
        style={{ backgroundColor: "var(--accent)" }}
      >
        추가
      </button>

      {open && portalTarget
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 p-4 fade-in"
              role="dialog"
              aria-modal="true"
              aria-labelledby="participant-add-modal-title"
              onClick={onBackdropClick}
              onKeyDown={onContainerKeyDown}
            >
              <div className="modal-surface w-full max-w-lg p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 id="participant-add-modal-title" className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>
                      이름으로 추가
                    </h3>
                    <p className="mt-1 text-xs font-semibold" style={{ color: "var(--ink-muted)" }}>
                      이름 기준으로 엔젤/운영진을 자동 분류합니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="btn-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold"
                    style={{ borderColor: "var(--line)", color: "var(--ink-muted)" }}
                    aria-label="닫기"
                  >
                    ×
                  </button>
                </div>

                {feedback ? (
                  <div
                    className="mt-4 rounded-xl border px-3 py-2 text-xs font-semibold"
                    style={feedbackPalette}
                  >
                    <p className="font-bold">{feedback.title}</p>
                    <p className="mt-1 leading-relaxed">{feedback.description}</p>
                  </div>
                ) : null}

                <form action={bulkCreateRsvpsAction} className="mt-4 grid gap-3">
                  <input type="hidden" name="meetingId" value={meetingId} />
                  <input type="hidden" name="returnDate" value={returnDate} />
                  <input type="hidden" name="returnPath" value={returnPath} />
                  <input type="hidden" name="mutationSource" value="manual-add" />
                  <label className="grid gap-1 text-xs font-bold" style={{ color: "var(--ink-soft)" }}>
                    이름
                    <textarea
                      name="names"
                      defaultValue={defaultNames}
                      className="min-h-28 rounded-xl border bg-white px-3 py-3 text-sm outline-none"
                      style={{ borderColor: feedback ? feedbackPalette.borderColor : "var(--line)", color: "var(--ink)" }}
                      placeholder="예: 장영실 또는 장영실, 이순신"
                      autoFocus
                    />
                  </label>
                  <p className="rounded-xl border px-3 py-2 text-[11px] leading-relaxed" style={{ borderColor: "#bfdbfe", backgroundColor: "#eff6ff", color: "var(--ink-soft)" }}>
                    프리셋에 없는 이름은 멤버로 추가됩니다.
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="btn-press h-10 rounded-xl border bg-white px-4 text-sm font-semibold"
                      style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
                    >
                      취소
                    </button>
                    <PendingSubmitButton
                      idleLabel="추가"
                      pendingLabel="추가 중"
                      className="btn-press h-10 rounded-xl px-4 text-sm font-bold text-white"
                      style={{ backgroundColor: "var(--accent)" }}
                    />
                  </div>
                </form>
              </div>
            </div>,
            portalTarget
          )
        : null}
    </>
  );
}
