"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type QuerySelectFilterOption = {
  label: string;
  value: string;
};

type QuerySelectFilterProps = {
  pathname: string;
  paramName: string;
  selectedValue?: string;
  options: QuerySelectFilterOption[];
  params?: Record<string, string | undefined>;
  hash?: string;
};

export function QuerySelectFilter({
  pathname,
  paramName,
  selectedValue = "",
  options,
  params = {},
  hash,
}: QuerySelectFilterProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <select
      value={selectedValue}
      onChange={(event) => {
        const nextValue = event.currentTarget.value.trim();
        const query = new URLSearchParams();

        for (const [key, value] of Object.entries(params)) {
          const normalizedValue = value?.trim();
          if (normalizedValue) {
            query.set(key, normalizedValue);
          }
        }

        if (nextValue) {
          query.set(paramName, nextValue);
        } else {
          query.delete(paramName);
        }

        const queryText = query.toString();
        const nextUrl = `${pathname}${queryText ? `?${queryText}` : ""}${hash ? `#${hash}` : ""}`;

        startTransition(() => {
          router.replace(nextUrl, { scroll: false });
        });
      }}
      className="h-10 w-full rounded-md border bg-white px-3 text-sm font-medium outline-none transition focus:ring-2"
      style={{
        borderColor: "var(--line)",
        color: "var(--ink)",
        "--tw-ring-color": "var(--accent)",
      } as React.CSSProperties}
    >
      {options.map((option) => (
        <option key={`${paramName}-${option.value || "all"}`} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
