"use client";

import { useState } from "react";

type LeaderChipInputProps = {
  name: string;
  initialLeaders?: string[];
  placeholder?: string;
};

function normalizeNames(values: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const name = value.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    normalized.push(name);
  }
  return normalized;
}

function parseNames(raw: string): string[] {
  return normalizeNames(raw.split(/[\n,;]+/));
}

export function LeaderChipInput({
  name,
  initialLeaders = [],
  placeholder = "방장 이름 입력 후 추가",
}: LeaderChipInputProps) {
  const [leaders, setLeaders] = useState<string[]>(normalizeNames(initialLeaders));
  const [draft, setDraft] = useState("");
  const inputStyle = {
    borderColor: "var(--line)",
    "--tw-ring-color": "var(--accent)",
  } as const;

  function addLeaders(raw: string): void {
    const names = parseNames(raw);
    if (names.length === 0) return;
    setLeaders((prev) => normalizeNames([...prev, ...names]));
    setDraft("");
  }

  function removeLeader(name: string): void {
    setLeaders((prev) => prev.filter((leader) => leader !== name));
  }

  return (
    <div className="grid gap-2">
      <input type="hidden" name={name} value={leaders.join(", ")} />

      <div
        className="flex min-h-10 flex-wrap gap-1.5 rounded-xl border bg-white px-2 py-2"
        style={{ borderColor: "var(--line)" }}
      >
        {leaders.length > 0 ? (
          leaders.map((leader) => (
            <span
              key={`leader-chip-${leader}`}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium"
              style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)", color: "var(--ink-soft)" }}
            >
              {leader}
              <button
                type="button"
                aria-label={`${leader} 삭제`}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[11px] leading-none transition hover:bg-black/10"
                onClick={() => removeLeader(leader)}
              >
                ×
              </button>
            </span>
          ))
        ) : (
          <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
            등록된 방장이 없어요
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={draft}
          data-leader-input="true"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key !== "Enter") return;
            event.preventDefault();
            addLeaders(draft);
          }}
          className="h-10 min-w-0 flex-1 rounded-xl border bg-white px-3 outline-none transition focus:ring-2"
          style={inputStyle}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="btn-press h-10 rounded-xl border px-3 text-xs font-semibold"
          style={{ borderColor: "var(--line)", color: "var(--ink-soft)", backgroundColor: "var(--surface)" }}
          onClick={() => addLeaders(draft)}
        >
          추가
        </button>
      </div>
    </div>
  );
}
