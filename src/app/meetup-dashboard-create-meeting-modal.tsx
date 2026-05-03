import { createMeetingAction } from "@/app/actions";
import { LeaderChipInput } from "@/app/leader-chip-input";
import type { CSSProperties } from "react";
import type { MeetingKind } from "@/lib/meeting-kind";

type CreateMeetingModalProps = {
  selectedDate: string;
  returnPath: string;
  meetingKind: MeetingKind;
  unitSlug: string;
};

export function CreateMeetingModal({
  selectedDate,
  returnPath,
  meetingKind,
  unitSlug,
}: CreateMeetingModalProps) {
  return (
    <details className="fixed bottom-6 right-6 z-40">
      <summary
        className="fab-pulse flex h-14 w-14 cursor-pointer list-none items-center justify-center rounded-full text-2xl font-semibold text-white shadow-lg transition hover:scale-105"
        style={{ backgroundColor: "var(--accent)", boxShadow: "0 16px 30px rgba(13, 127, 242, 0.35)" }}
      >
        +
      </summary>

      <div
        className="modal-surface absolute bottom-18 right-0 max-h-[calc(100vh-8rem)] w-[min(calc(100vw-3rem),720px)] overflow-y-auto p-4 backdrop-blur-md fade-in"
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-base font-extrabold" style={{ color: "var(--ink)" }}>모임 만들기</p>
            <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
              기본 정보만 먼저 입력하고, 참여자는 상세 화면에서 관리합니다.
            </p>
          </div>
          <span
            className="rounded-full border px-2.5 py-1 text-xs font-semibold"
            style={{ borderColor: "rgba(13, 127, 242, 0.2)", backgroundColor: "var(--accent-weak)", color: "var(--accent-strong)" }}
          >
            {meetingKind === "loop-pak" ? "루프팩" : "스터디"}
          </span>
        </div>

        <form action={createMeetingAction} className="grid gap-3">
          <input type="hidden" name="returnDate" value={selectedDate} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <input type="hidden" name="unit" value={unitSlug} />
          <input type="hidden" name="meetingKind" value={meetingKind} />

          <section
            className="grid gap-3 rounded-xl border p-3 sm:grid-cols-6"
            style={{ borderColor: "rgba(13, 127, 242, 0.18)", backgroundColor: "var(--accent-weak)" }}
          >
            <label className="grid min-w-0 gap-1 text-sm sm:col-span-3" style={{ color: "var(--ink-soft)" }}>
              <span className="font-medium">모임 이름</span>
              <input
                name="title"
                required
                maxLength={80}
                className="h-10 min-w-0 rounded-xl border bg-white px-3 outline-none transition focus:ring-2"
                style={{ borderColor: "rgba(13, 127, 242, 0.22)", "--tw-ring-color": "var(--accent)" } as CSSProperties}
                placeholder="예: 11주차 오프라인 수료식"
              />
            </label>

            <label className="grid min-w-0 gap-1 text-sm sm:col-span-3" style={{ color: "var(--ink-soft)" }}>
              <span className="font-medium">장소/주소</span>
              <input
                name="location"
                required
                maxLength={160}
                className="h-10 min-w-0 rounded-xl border bg-white px-3 outline-none transition focus:ring-2"
                style={{ borderColor: "rgba(13, 127, 242, 0.22)", "--tw-ring-color": "var(--accent)" } as CSSProperties}
                placeholder="예: 모드라운지 학동점 / https://naver.me/..."
              />
            </label>
          </section>

          <section
            className="grid gap-3 rounded-xl border p-3 sm:grid-cols-6"
            style={{ borderColor: "rgba(34, 197, 94, 0.2)", backgroundColor: "var(--success-bg)" }}
          >
            <label className="grid min-w-0 gap-1 text-sm sm:col-span-3" style={{ color: "var(--ink-soft)" }}>
              <span className="font-medium">날짜</span>
              <input
                name="meetingDate"
                type="date"
                defaultValue={selectedDate}
                required
                className="h-10 min-w-0 rounded-xl border bg-white px-3 outline-none transition focus:ring-2"
                style={{ borderColor: "rgba(34, 197, 94, 0.25)", "--tw-ring-color": "var(--success)" } as CSSProperties}
              />
            </label>

            <label className="grid min-w-0 gap-1 text-sm sm:col-span-3" style={{ color: "var(--ink-soft)" }}>
              <span className="font-medium">시작 시간</span>
              <input
                name="startTime"
                type="time"
                defaultValue="14:00"
                required
                className="h-10 min-w-0 rounded-xl border bg-white px-3 outline-none transition focus:ring-2"
                style={{ borderColor: "rgba(34, 197, 94, 0.25)", "--tw-ring-color": "var(--success)" } as CSSProperties}
              />
            </label>
          </section>

          <section
            className="grid gap-3 rounded-xl border p-3 sm:grid-cols-6"
            style={{ borderColor: "rgba(148, 163, 184, 0.35)", backgroundColor: "var(--surface-alt)" }}
          >
            <label className="grid min-w-0 gap-1 text-sm sm:col-span-3" style={{ color: "var(--ink-soft)" }}>
              <span className="font-medium">방장</span>
              <LeaderChipInput name="leaders" placeholder="방장 이름 입력" />
            </label>

            <label className="grid min-w-0 gap-1 text-sm sm:col-span-3" style={{ color: "var(--ink-soft)" }}>
              <span className="font-medium">수정 비밀번호</span>
              <input
                name="meetingPassword"
                type="password"
                maxLength={80}
                autoComplete="new-password"
                className="h-10 min-w-0 rounded-xl border bg-white px-3 outline-none transition focus:ring-2"
                style={{ borderColor: "var(--line)", "--tw-ring-color": "var(--accent)" } as CSSProperties}
                placeholder="선택"
              />
            </label>

            <label className="grid min-w-0 gap-1 text-sm sm:col-span-6" style={{ color: "var(--ink-soft)" }}>
              <span className="font-medium">설명 (선택)</span>
              <input
                name="description"
                maxLength={240}
                className="h-10 min-w-0 rounded-xl border bg-white px-3 outline-none transition focus:ring-2"
                style={{ borderColor: "var(--line)", "--tw-ring-color": "var(--accent)" } as CSSProperties}
                placeholder="예: 팀별 진행 후 15:00 전체 정리"
              />
            </label>
          </section>

          <button
            type="submit"
            className="btn-press h-11 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: "var(--accent)", boxShadow: "0 10px 20px rgba(13, 127, 242, 0.25)" }}
          >
            생성
          </button>
        </form>
      </div>
    </details>
  );
}
