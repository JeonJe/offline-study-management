"use client";

import {
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type EditManageModalProps = {
  children: ReactNode;
};

export function EditManageModal({ children }: EditManageModalProps) {
  const [open, setOpen] = useState(false);
  const portalTarget = typeof window === "undefined" ? null : document.body;

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
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
    if (event.target === event.currentTarget) {
      closeModal();
    }
  }

  function onContainerKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      closeModal();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-press inline-flex h-10 items-center rounded-xl border bg-white px-4 text-sm font-semibold shadow-sm transition hover:border-stone-400"
        style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
      >
        수정 관리
      </button>

      {open && portalTarget
        ? createPortal(
            <div
              className="fixed inset-0 z-50 overflow-y-auto p-4 fade-in sm:p-6"
              style={{ backgroundColor: "rgba(28, 25, 23, 0.4)", backdropFilter: "blur(6px)" }}
              role="dialog"
              aria-modal="true"
              onClick={onBackdropClick}
              onKeyDown={onContainerKeyDown}
            >
              <div
                className="mx-auto my-4 w-full max-w-4xl overflow-hidden rounded-2xl border shadow-2xl"
                style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
              >
                <div
                  className="sticky top-0 z-10 mb-0 flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-5"
                  style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}
                >
                  <h2 className="text-base font-semibold" style={{ color: "var(--ink)" }}>수정 관리</h2>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="btn-press flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-semibold transition hover:border-stone-400"
                    style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
                  >
                    ×
                  </button>
                </div>
                <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto p-4 sm:p-5">
                  {children}
                </div>
              </div>
            </div>,
            portalTarget
          )
        : null}
    </>
  );
}
