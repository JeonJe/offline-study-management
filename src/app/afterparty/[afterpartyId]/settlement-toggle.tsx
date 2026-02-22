"use client";

import { useRef, useState } from "react";
import { updateAfterpartyParticipantSettlementAction } from "@/app/actions";

type SettlementToggleProps = {
  afterpartyId: string;
  participantId: string;
  returnDate: string;
  returnPath: string;
  isSettled: boolean;
};

export function SettlementToggle({
  afterpartyId,
  participantId,
  returnDate,
  returnPath,
  isSettled,
}: SettlementToggleProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [checked, setChecked] = useState(isSettled);

  return (
    <form ref={formRef} action={updateAfterpartyParticipantSettlementAction} className="inline-flex items-center">
      <input type="hidden" name="afterpartyId" value={afterpartyId} />
      <input type="hidden" name="participantId" value={participantId} />
      <input type="hidden" name="returnDate" value={returnDate} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <input type="hidden" name="isSettled" value={checked ? "true" : "false"} />

      <label className="inline-flex cursor-pointer items-center gap-1.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => {
            const nextChecked = event.currentTarget.checked;
            setChecked(nextChecked);
            formRef.current?.requestSubmit();
          }}
          className="peer sr-only"
        />
        <span
          className="relative h-5 w-9 rounded-full transition-colors peer-checked:bg-emerald-600"
          style={{ backgroundColor: checked ? "#059669" : "#d6d3d1" }}
        >
          <span
            className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
            style={{ left: checked ? "1.1rem" : "0.125rem" }}
          />
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={
            checked
              ? { backgroundColor: "var(--success-bg)", color: "var(--success)" }
              : { backgroundColor: "var(--surface-alt)", color: "var(--ink-muted)" }
          }
        >
          {checked ? "정산 완료" : "미정산"}
        </span>
      </label>
    </form>
  );
}
