"use client";

import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/app/pending-submit-button";

type DeleteOperatingUnitConfirmButtonProps = {
  formId: string;
  unitName: string;
};

export function DeleteOperatingUnitConfirmButton({
  formId,
  unitName,
}: DeleteOperatingUnitConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="btn-press rounded-full border px-4 py-2 text-sm font-bold"
        style={{ borderColor: "#fecaca", backgroundColor: "#fef2f2", color: "#991b1b" }}
        onClick={() => setOpen(true)}
      >
        삭제
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-operating-unit-title"
            className="modal-surface w-full max-w-sm p-5 shadow-xl"
          >
            <h2
              id="delete-operating-unit-title"
              className="text-base font-extrabold"
              style={{ color: "var(--ink)" }}
            >
              기수를 삭제할까요?
            </h2>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--ink-soft)" }}>
              <strong>{unitName}</strong>을 정말 삭제하시겠습니까?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full border px-4 py-2 text-sm font-bold"
                style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
                onClick={() => setOpen(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="btn-press rounded-full px-4 py-2 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-70"
                style={{ backgroundColor: "var(--danger)" }}
                disabled={pending}
                aria-busy={pending}
                onClick={() => {
                  setPending(true);
                  const form = document.getElementById(formId) as HTMLFormElement | null;
                  form?.requestSubmit();
                }}
              >
                <span className="inline-flex items-center justify-center gap-1.5">
                  {pending ? <LoadingSpinner /> : null}
                  {pending ? "삭제 중" : "삭제"}
                </span>
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
