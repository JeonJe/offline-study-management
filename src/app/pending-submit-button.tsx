"use client";

import type { CSSProperties, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type PendingSubmitButtonProps = {
  idleLabel?: string;
  pendingLabel?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  pendingChildren?: ReactNode;
  disabled?: boolean;
};

export function PendingSubmitButton({
  idleLabel,
  pendingLabel = "처리중...",
  className,
  style,
  children,
  pendingChildren,
  disabled = false,
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;

  return (
    <button
      type="submit"
      className={className}
      style={style}
      disabled={isDisabled}
      aria-busy={pending}
    >
      {pending ? (pendingChildren ?? pendingLabel) : (children ?? idleLabel)}
    </button>
  );
}
