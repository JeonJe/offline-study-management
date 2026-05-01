import {
  type MemberAttendanceRow,
  type TeamAttendanceRow,
} from "@/lib/history-store";

type AttendanceChartProps =
  | {
      kind: "team";
      rows: TeamAttendanceRow[];
    }
  | {
      kind: "member";
      rows: MemberAttendanceRow[];
    };

type ChartBar = {
  label: string;
  value: number;
  text: string;
};

function teamBars(rows: TeamAttendanceRow[]): ChartBar[] {
  return rows
    .map((row) => ({
      label: row.team,
      value: Math.round(row.rate * 100),
      text: `${Math.round(row.rate * 100)}%`,
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "ko"))
    .slice(0, 8);
}

function memberBars(rows: MemberAttendanceRow[]): ChartBar[] {
  return rows
    .map((row) => ({
      label: row.name,
      value: row.meetings + row.afterparties,
      text: `${row.meetings + row.afterparties}회`,
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "ko"))
    .slice(0, 8);
}

export function AttendanceChart(props: AttendanceChartProps) {
  const bars = props.kind === "team" ? teamBars(props.rows) : memberBars(props.rows);
  const maxValue = Math.max(...bars.map((bar) => bar.value), 0);

  return (
    <section className="card-static p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>
            {props.kind === "team" ? "팀 참여율 상위" : "멤버 참여 합계 상위"}
          </h3>
          <p className="mt-1 text-sm leading-6" style={{ color: "var(--ink-muted)" }}>
            {props.kind === "team"
              ? "기간 내 팀별 모임 참여율을 막대로 비교합니다."
              : "기간 내 모임과 뒷풀이 참여 합계를 막대로 비교합니다."}
          </p>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs font-bold" style={{ borderColor: "var(--line)", color: "var(--ink-muted)" }}>
          SVG · dependency 0
        </span>
      </div>

      {bars.length === 0 || maxValue === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed px-4 py-8 text-center text-sm" style={{ borderColor: "var(--line)", color: "var(--ink-muted)" }}>
          차트로 표시할 데이터가 없습니다.
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {bars.map((bar) => {
            const width = `${Math.max(8, Math.round((bar.value / maxValue) * 100))}%`;
            return (
              <div key={`${props.kind}-${bar.label}`} className="grid gap-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-bold" style={{ color: "var(--ink)" }}>{bar.label}</span>
                  <span className="shrink-0 font-bold" style={{ color: "var(--accent-strong)" }}>{bar.text}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-alt)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width, backgroundColor: "var(--accent)" }}
                    aria-label={`${bar.label} ${bar.text}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
