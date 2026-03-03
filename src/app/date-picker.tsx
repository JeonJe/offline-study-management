"use client";

import { useRouter } from "next/navigation";

type DatePickerProps = {
  selectedDate: string;
  basePath?: string;
};

export function DatePicker({ selectedDate, basePath = "/" }: DatePickerProps) {
  const router = useRouter();

  return (
    <input
      name="date"
      type="date"
      value={selectedDate}
      onChange={(event) => {
        const nextDate = event.currentTarget.value;
        router.push(nextDate ? `${basePath}?date=${encodeURIComponent(nextDate)}` : basePath);
      }}
      className="h-10 w-full rounded-xl border bg-white px-3 text-sm font-medium outline-none transition focus:ring-2"
      style={{
        borderColor: "var(--line)",
        "--tw-ring-color": "var(--accent)",
      } as React.CSSProperties}
    />
  );
}
