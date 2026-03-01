"use client";

import type { CSSProperties } from "react";
import { useFormStatus } from "react-dom";

type PendingSubmitButtonProps = {
  idleLabel: string;
  pendingLabel?: string;
  className?: string;
  style?: CSSProperties;
};

export function PendingSubmitButton({
  idleLabel,
  pendingLabel = "처리중...",
  className,
  style,
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      style={style}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

