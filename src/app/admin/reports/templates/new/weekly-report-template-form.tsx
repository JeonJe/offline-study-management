"use client";

import { useState } from "react";

type TemplateSectionDraft = {
  id: number;
  title: string;
  prompt: string;
};

type WeeklyReportTemplateFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  templateId?: string;
  initialName?: string;
  initialPrompt?: string;
  initialSections?: Array<{
    title: string;
    prompt: string;
  }>;
  submitLabel?: string;
  unitSlug: string;
};

const FIELD_CLASS = "h-12 w-full rounded-xl border bg-white px-3 text-sm";
const TEXTAREA_CLASS = "min-h-24 w-full rounded-xl border bg-white px-3 py-3 text-sm";
const MAX_SECTION_COUNT = 4;

const SECTION_PRESETS: Array<Omit<TemplateSectionDraft, "id">> = [
  {
    title: "팀 현황",
    prompt: "이번 주 팀 분위기와 참여 상황을 적어주세요.",
  },
  {
    title: "특이사항",
    prompt: "따로 기록할 일이 있으면 적어주세요.",
  },
  {
    title: "도움이 필요한 점",
    prompt: "운영진 확인이나 지원이 필요한 내용을 적어주세요.",
  },
  {
    title: "다음 할 일",
    prompt: "다음 주까지 챙길 일이 있으면 적어주세요.",
  },
];

export function WeeklyReportTemplateForm({
  action,
  templateId,
  initialName = "",
  initialPrompt = "",
  initialSections,
  submitLabel = "저장",
  unitSlug,
}: WeeklyReportTemplateFormProps) {
  const [sections, setSections] = useState<TemplateSectionDraft[]>([
    ...(initialSections?.length
      ? initialSections.slice(0, MAX_SECTION_COUNT).map((section, index) => ({
          id: index + 1,
          title: section.title,
          prompt: section.prompt,
        }))
      : [
          {
            id: 1,
            ...SECTION_PRESETS[0],
          },
        ]),
  ]);

  const canAddSection = sections.length < MAX_SECTION_COUNT;

  function addSection() {
    if (!canAddSection) return;
    const preset = SECTION_PRESETS[sections.length] ?? {
      title: "",
      prompt: "",
    };
    setSections((current) => [
      ...current,
      {
        id: Date.now(),
        ...preset,
      },
    ]);
  }

  function removeSection(id: number) {
    setSections((current) => current.filter((section) => section.id !== id));
  }

  return (
    <form action={action} className="mt-6 grid gap-5">
      <input type="hidden" name="unit" value={unitSlug} />
      {templateId ? <input type="hidden" name="templateId" value={templateId} /> : null}

      <label className="grid gap-2 text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
        템플릿 이름
        <input
          name="name"
          required
          defaultValue={initialName}
          placeholder="예: 루퍼스 주간 보고"
          className={FIELD_CLASS}
          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
        전체 안내
        <textarea
          name="prompt"
          required
          rows={3}
          defaultValue={initialPrompt}
          placeholder="예: 이번 주 팀 상황을 아래 항목에 맞춰 작성해주세요."
          className={TEXTAREA_CLASS}
          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        />
      </label>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-extrabold" style={{ color: "var(--ink)" }}>
            입력 항목
          </h3>
          <button
            type="button"
            onClick={addSection}
            disabled={!canAddSection}
            className="btn-press rounded-full border px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45"
            style={{
              borderColor: "rgba(13, 127, 242, 0.28)",
              backgroundColor: "var(--accent-weak)",
              color: "var(--accent-strong)",
            }}
          >
            + 항목 추가
          </button>
        </div>

        <div className="grid gap-3">
          {sections.map((section, index) => (
            <article
              key={section.id}
              className="grid gap-4 rounded-2xl border bg-white p-4"
              style={{ borderColor: index === 0 ? "rgba(13, 127, 242, 0.35)" : "var(--line)" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-sm" style={{ color: "var(--ink)" }}>
                  항목 {index + 1}
                </strong>
                <div className="flex items-center gap-2">
                  {index === 0 ? (
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-bold"
                      style={{ backgroundColor: "var(--accent-weak)", color: "var(--accent-strong)" }}
                    >
                      필수
                    </span>
                  ) : null}
                  {index > 0 ? (
                    <button
                      type="button"
                      onClick={() => removeSection(section.id)}
                      className="rounded-full border px-3 py-1 text-xs font-bold"
                      style={{
                        borderColor: "var(--line)",
                        backgroundColor: "var(--surface)",
                        color: "var(--ink-muted)",
                      }}
                    >
                      삭제
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                <label className="grid gap-2 text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
                  제목
                  <input
                    name="sectionTitle"
                    required={index === 0}
                    defaultValue={section.title}
                    placeholder="예: 팀 현황"
                    className={FIELD_CLASS}
                    style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
                  작성 가이드
                  <input
                    name="sectionPrompt"
                    required={index === 0}
                    defaultValue={section.prompt}
                    placeholder="예: 이번 주 팀 분위기와 참여 상황을 적어주세요."
                    className={FIELD_CLASS}
                    style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          className="btn-press h-12 min-w-32 rounded-full px-6 text-sm font-bold text-white"
          style={{ backgroundColor: "var(--accent)" }}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
