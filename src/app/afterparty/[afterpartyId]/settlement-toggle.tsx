"use client";

import { useEffect, useState, useTransition } from "react";
import { updateSettlementAction } from "@/app/actions";

type SettlementToggleProps = {
  afterpartyId: string;
  participantId: string;
  isSettled: boolean;
};

export function SettlementToggle({
  afterpartyId,
  participantId,
  isSettled,
}: SettlementToggleProps) {
  const [checked, setChecked] = useState(isSettled);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setChecked(isSettled);
  }, [isSettled]);

  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5">
      <input
        type="checkbox"
        checked={checked}
        disabled={isPending}
        onChange={(event) => {
          const nextChecked = event.currentTarget.checked;
          setChecked(nextChecked);
          startTransition(async () => {
            const result = await updateSettlementAction(participantId, afterpartyId, nextChecked);
            if (!result.ok) {
              setChecked(!nextChecked);
            }
          });
        }}
        className="peer sr-only"
      />
      <span
        className="relative h-5 w-9 rounded-full transition-colors peer-checked:bg-emerald-600"
        style={{ backgroundColor: checked ? "#059669" : "#d6d3d1", opacity: isPending ? 0.7 : 1 }}
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
  );
}
