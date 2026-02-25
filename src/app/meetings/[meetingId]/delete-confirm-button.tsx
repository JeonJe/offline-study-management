"use client";

import type { CSSProperties } from "react";

type DeleteConfirmButtonProps = {
  confirmMessage: string;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
  title?: string;
  children: React.ReactNode;
};

export function DeleteConfirmButton({
  confirmMessage,
  className,
  style,
  "aria-label": ariaLabel,
  title,
  children,
}: DeleteConfirmButtonProps) {
  return (
    <button
      type="submit"
      className={className}
      style={style}
      aria-label={ariaLabel}
      title={title}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
