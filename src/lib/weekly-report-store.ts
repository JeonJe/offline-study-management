import { randomUUID } from "node:crypto";
import { query } from "@/lib/db";
import {
  DEFAULT_OPERATING_UNIT_SLUG,
  ensureOperatingUnitColumn,
  ensureOperatingUnitSchema,
} from "@/lib/operating-unit-store";

export type WeeklyReportCycleStatus = "open" | "closed";

export type WeeklyReportCycle = {
  id: string;
  templateId: string | null;
  title: string;
  weekLabel: string;
  startDate: string | null;
  dueDate: string | null;
  prompt: string | null;
  status: WeeklyReportCycleStatus;
  reportCount: number;
  createdAt: string;
};

export type WeeklyReportTemplate = {
  id: string;
  name: string;
  prompt: string;
  sections: WeeklyReportTemplateSection[];
  isDefault: boolean;
  createdAt: string;
};

export type WeeklyReportTemplateSectionKey =
  | "summary"
  | "notes"
  | "requests"
  | "actionItems";

export type WeeklyReportTemplateSection = {
  key: WeeklyReportTemplateSectionKey;
  title: string;
  prompt: string;
  required: boolean;
};

export type AngelWeeklyReport = {
  id: string;
  cycleId: string;
  angelName: string;
  teamName: string;
  summary: string;
  notes: string | null;
  requests: string | null;
  actionItems: string | null;
  submittedAt: string;
  updatedAt: string;
};

export type WeeklyReportCycleWithReports = WeeklyReportCycle & {
  reports: AngelWeeklyReport[];
};

type CreateWeeklyReportCycleInput = {
  templateId?: string;
  title: string;
  weekLabel: string;
  startDate?: string;
  dueDate?: string;
  prompt?: string;
};

type UpdateWeeklyReportCycleInput = CreateWeeklyReportCycleInput & {
  id: string;
};

type UpsertAngelWeeklyReportInput = {
  cycleId: string;
  angelName: string;
  teamName: string;
  summary: string;
  notes?: string;
  requests?: string;
  actionItems?: string;
};

type CreateWeeklyReportTemplateInput = {
  name: string;
  prompt: string;
  sections?: Array<{
    title?: string;
    prompt?: string;
  }>;
  summaryTitle?: string;
  summaryPrompt?: string;
  notesTitle?: string;
  notesPrompt?: string;
  requestsTitle?: string;
  requestsPrompt?: string;
  actionItemsTitle?: string;
  actionItemsPrompt?: string;
};

type UpdateWeeklyReportTemplateInput = CreateWeeklyReportTemplateInput & {
  id: string;
};

export type WeeklyReportCommentAuthorRole = 'admin' | 'angel' | 'leader';

// 댓글 작성자 역할 화이트리스트. SM-3B server action에서 동일 검증에 재사용한다.
export const VALID_AUTHOR_ROLES: readonly WeeklyReportCommentAuthorRole[] = [
  'admin',
  'angel',
  'leader',
] as const;

export type WeeklyReportComment = {
  id: string;
  reportId: string;
  // author_role은 표시 목적. 실제 권한 검증은 role-session의 RolePageRole로 수행 (SM-3B에서 매핑)
  authorRole: WeeklyReportCommentAuthorRole;
  authorLabel: string;
  body: string;
  createdAt: string;
};

type AddWeeklyReportCommentInput = {
  reportId: string;
  authorRole: WeeklyReportCommentAuthorRole;
  authorLabel: string;
  body: string;
};

type SchemaRow = {
  cycles: string | null;
  reports: string | null;
};

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

export function _resetSchemaStateForTesting(): void {
  schemaReady = false;
  schemaPromise = null;
}

function cleanText(value?: string | null): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function nullableText(value?: string | null): string | null {
  const normalized = cleanText(value);
  return normalized || null;
}

function normalizeDate(value?: string | null): string | null {
  const normalized = cleanText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

export const DEFAULT_WEEKLY_REPORT_TEMPLATE_SECTIONS: WeeklyReportTemplateSection[] = [
  {
    key: "summary",
    title: "팀 현황",
    prompt: "이번 주 팀 분위기와 참여 상황을 적어주세요.",
    required: true,
  },
  {
    key: "notes",
    title: "특이사항",
    prompt: "따로 기록할 일이 있으면 적어주세요.",
    required: false,
  },
  {
    key: "requests",
    title: "도움이 필요한 점",
    prompt: "운영진 확인이나 지원이 필요한 내용을 적어주세요.",
    required: false,
  },
  {
    key: "actionItems",
    title: "다음 할 일",
    prompt: "다음 주까지 챙길 일이 있으면 적어주세요.",
    required: false,
  },
];

function normalizeTemplateSections(
  sections: unknown
): WeeklyReportTemplateSection[] {
  if (!Array.isArray(sections)) {
    return DEFAULT_WEEKLY_REPORT_TEMPLATE_SECTIONS;
  }

  const normalized = sections.flatMap((section, index) => {
    if (typeof section !== "object" || section === null) return [];
    const fallback = DEFAULT_WEEKLY_REPORT_TEMPLATE_SECTIONS[index];
    if (!fallback) return [];
    const title = typeof section?.title === "string" ? cleanText(section.title) : "";
    const prompt = typeof section?.prompt === "string" ? cleanText(section.prompt) : "";
    if (!title && !prompt) return [];
    return [{
      key: fallback.key,
      title: title || fallback.title,
      prompt: prompt || fallback.prompt,
      required: fallback.required,
    }];
  });

  return normalized.length > 0
    ? normalized
    : DEFAULT_WEEKLY_REPORT_TEMPLATE_SECTIONS;
}

function buildTemplateSections(
  input: CreateWeeklyReportTemplateInput
): WeeklyReportTemplateSection[] {
  if (input.sections?.length) {
    return normalizeTemplateSections(
      input.sections.slice(0, DEFAULT_WEEKLY_REPORT_TEMPLATE_SECTIONS.length)
    );
  }

  return normalizeTemplateSections([
    {
      key: "summary",
      title: input.summaryTitle,
      prompt: input.summaryPrompt,
      required: true,
    },
    {
      key: "notes",
      title: input.notesTitle,
      prompt: input.notesPrompt,
      required: false,
    },
    {
      key: "requests",
      title: input.requestsTitle,
      prompt: input.requestsPrompt,
      required: false,
    },
    {
      key: "actionItems",
      title: input.actionItemsTitle,
      prompt: input.actionItemsPrompt,
      required: false,
    },
  ]);
}

async function hasWeeklyReportSchema(): Promise<boolean> {
  const [row] = await query<SchemaRow>(
    `select
       to_regclass('public.weekly_report_cycles')::text as cycles,
       to_regclass('public.angel_weekly_reports')::text as reports`
  );

  return Boolean(row?.cycles && row?.reports);
}

export async function ensureWeeklyReportSchema(): Promise<void> {
  if (schemaReady || process.env.SKIP_SCHEMA_CHECK === "1") return;
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    await hasWeeklyReportSchema();
    await ensureOperatingUnitSchema();

    await query(
       `create table if not exists public.weekly_report_templates (
         id uuid primary key,
         name text not null,
         prompt text not null,
         sections jsonb not null default '[]'::jsonb,
         is_default boolean not null default false,
         operating_unit_slug text not null default '${DEFAULT_OPERATING_UNIT_SLUG}',
         created_at timestamptz not null default now(),
         updated_at timestamptz not null default now()
       )`
    );

    await query(
      `create index if not exists idx_weekly_report_templates_created
       on public.weekly_report_templates (created_at desc)`
    );

    await query(
      `alter table public.weekly_report_templates
       add column if not exists prompt text not null default ''`
    );

    await query(
      `alter table public.weekly_report_templates
       add column if not exists sections jsonb not null default '[]'::jsonb`
    );

    await ensureOperatingUnitColumn(
      "weekly_report_templates",
      "idx_weekly_report_templates_operating_unit"
    );

    await query(
      `create table if not exists public.weekly_report_cycles (
         id uuid primary key,
         template_id uuid,
         title text not null,
         week_label text not null,
         start_date date,
         due_date date,
         prompt text,
         status text not null default 'open' check (status in ('open', 'closed')),
         operating_unit_slug text not null default '${DEFAULT_OPERATING_UNIT_SLUG}',
         created_at timestamptz not null default now(),
         updated_at timestamptz not null default now()
       )`
    );

    await query(
      `alter table public.weekly_report_cycles
       add column if not exists template_id uuid`
    );

    await ensureOperatingUnitColumn(
      "weekly_report_cycles",
      "idx_weekly_report_cycles_operating_unit"
    );

    await query(
      `create index if not exists idx_weekly_report_cycles_status_created
       on public.weekly_report_cycles (status, created_at desc)`
    );

    await query(
      `create table if not exists public.angel_weekly_reports (
         id uuid primary key,
         cycle_id uuid not null references public.weekly_report_cycles(id) on delete cascade,
         angel_name text not null,
         team_name text not null,
         summary text not null,
         notes text,
         requests text,
         action_items text,
         submitted_at timestamptz not null default now(),
         updated_at timestamptz not null default now(),
         unique (cycle_id, angel_name, team_name)
       )`
    );

    await query(
      `create index if not exists idx_angel_weekly_reports_cycle
       on public.angel_weekly_reports (cycle_id, updated_at desc)`
    );

    await query(
      `create table if not exists public.weekly_report_comments (
         id           uuid primary key,
         report_id    uuid not null references public.angel_weekly_reports(id) on delete cascade,
         author_role  text not null check (author_role in ('admin', 'angel', 'leader')),
         author_label text not null,
         body         text not null,
         created_at   timestamptz not null default now(),
         deleted_at   timestamptz
       )`
    );

    await query(
      `create index if not exists idx_weekly_report_comments_report
       on public.weekly_report_comments (report_id, created_at asc)
       where deleted_at is null`
    );

    schemaReady = true;
  })().finally(() => {
    schemaPromise = null;
  });

  return schemaPromise;
}

export async function createWeeklyReportTemplate(
  input: CreateWeeklyReportTemplateInput
): Promise<WeeklyReportTemplate> {
  await ensureWeeklyReportSchema();

  const name = cleanText(input.name);
  const prompt = cleanText(input.prompt);
  const sections = buildTemplateSections(input);

  if (!name || !prompt) {
    throw new Error("템플릿 이름과 전체 안내는 필수입니다.");
  }

  const [created] = await query<WeeklyReportTemplate>(
    `insert into public.weekly_report_templates (id, name, prompt, sections, operating_unit_slug)
     values ($1, $2, $3, $4::jsonb, $5)
     returning
       id,
       name,
       prompt,
       sections,
       is_default as "isDefault",
       created_at::text as "createdAt"`,
    [randomUUID(), name, prompt, JSON.stringify(sections), DEFAULT_OPERATING_UNIT_SLUG]
  );

  if (!created) {
    throw new Error("주간 보고 템플릿을 만들 수 없습니다.");
  }

  return {
    ...created,
    sections: normalizeTemplateSections(created.sections),
  };
}

export async function listWeeklyReportTemplates(): Promise<WeeklyReportTemplate[]> {
  await ensureWeeklyReportSchema();

  return query<WeeklyReportTemplate>(
    `select
       id,
       name,
       prompt,
       sections,
       is_default as "isDefault",
       created_at::text as "createdAt"
     from public.weekly_report_templates
     where coalesce(operating_unit_slug, $1) = $1
     order by is_default desc, created_at desc`
    ,
    [DEFAULT_OPERATING_UNIT_SLUG]
  ).then((templates) =>
    templates.map((template) => ({
      ...template,
      sections: normalizeTemplateSections(template.sections),
    }))
  );
}

export async function getWeeklyReportTemplateById(
  templateId: string | null | undefined
): Promise<WeeklyReportTemplate | null> {
  await ensureWeeklyReportSchema();

  const id = cleanText(templateId);
  if (!id) return null;

  const [template] = await query<WeeklyReportTemplate>(
    `select
       id,
       name,
       prompt,
       sections,
       is_default as "isDefault",
       created_at::text as "createdAt"
     from public.weekly_report_templates
     where id = $1
       and coalesce(operating_unit_slug, $2) = $2
     limit 1`,
    [id, DEFAULT_OPERATING_UNIT_SLUG]
  );

  return template
    ? {
        ...template,
        sections: normalizeTemplateSections(template.sections),
      }
    : null;
}

export async function updateWeeklyReportTemplate(
  input: UpdateWeeklyReportTemplateInput
): Promise<WeeklyReportTemplate> {
  await ensureWeeklyReportSchema();

  const id = cleanText(input.id);
  const name = cleanText(input.name);
  const prompt = cleanText(input.prompt);
  const sections = buildTemplateSections(input);

  if (!id || !name || !prompt) {
    throw new Error("템플릿, 이름, 전체 안내는 필수입니다.");
  }

  const [updated] = await query<WeeklyReportTemplate>(
    `update public.weekly_report_templates
     set
       name = $2,
       prompt = $3,
       sections = $4::jsonb,
       updated_at = now()
     where id = $1
       and coalesce(operating_unit_slug, $5) = $5
     returning
       id,
       name,
       prompt,
       sections,
       is_default as "isDefault",
       created_at::text as "createdAt"`,
    [id, name, prompt, JSON.stringify(sections), DEFAULT_OPERATING_UNIT_SLUG]
  );

  if (!updated) {
    throw new Error("주간 보고 템플릿을 수정할 수 없습니다.");
  }

  return {
    ...updated,
    sections: normalizeTemplateSections(updated.sections),
  };
}

export async function deleteWeeklyReportTemplate(templateId: string): Promise<void> {
  await ensureWeeklyReportSchema();

  const id = cleanText(templateId);
  if (!id) {
    throw new Error("삭제할 템플릿을 찾을 수 없습니다.");
  }

  await query(
    `update public.weekly_report_cycles
     set template_id = null, updated_at = now()
     where template_id = $1
       and coalesce(operating_unit_slug, $2) = $2`,
    [id, DEFAULT_OPERATING_UNIT_SLUG]
  );

  await query(
    `delete from public.weekly_report_templates
     where id = $1
       and coalesce(operating_unit_slug, $2) = $2`,
    [id, DEFAULT_OPERATING_UNIT_SLUG]
  );
}

export async function createWeeklyReportCycle(
  input: CreateWeeklyReportCycleInput
): Promise<WeeklyReportCycle> {
  await ensureWeeklyReportSchema();

  const templateId = cleanText(input.templateId);
  const title = cleanText(input.title);
  const weekLabel = cleanText(input.weekLabel);

  if (!title || !weekLabel) {
    throw new Error("주간 보고 제목과 주차는 필수입니다.");
  }

  const templatePrompt = templateId
    ? (await query<{ prompt: string }>(
        `select prompt
         from public.weekly_report_templates
         where id = $1
           and coalesce(operating_unit_slug, $2) = $2
         limit 1`,
        [templateId, DEFAULT_OPERATING_UNIT_SLUG]
      ))[0]?.prompt
    : "";
  const prompt = nullableText(input.prompt) ?? nullableText(templatePrompt);

  const [created] = await query<WeeklyReportCycle>(
    `insert into public.weekly_report_cycles (
       id, template_id, title, week_label, start_date, due_date, prompt, operating_unit_slug
     )
     values ($1, $2::uuid, $3, $4, $5::date, $6::date, $7, $8)
     returning
       id,
       template_id as "templateId",
       title,
       week_label as "weekLabel",
       start_date::text as "startDate",
       due_date::text as "dueDate",
       prompt,
       status,
       0 as "reportCount",
       created_at::text as "createdAt"`,
    [
      randomUUID(),
      templateId || null,
      title,
      weekLabel,
      normalizeDate(input.startDate),
      normalizeDate(input.dueDate),
      prompt,
      DEFAULT_OPERATING_UNIT_SLUG,
    ]
  );

  if (!created) {
    throw new Error("주간 보고 요청을 만들 수 없습니다.");
  }

  return created;
}

export async function updateWeeklyReportCycle(
  input: UpdateWeeklyReportCycleInput
): Promise<WeeklyReportCycle> {
  await ensureWeeklyReportSchema();

  const id = cleanText(input.id);
  const templateId = cleanText(input.templateId);
  const title = cleanText(input.title);
  const weekLabel = cleanText(input.weekLabel);

  if (!id || !title || !weekLabel) {
    throw new Error("주간 보고, 제목, 주차는 필수입니다.");
  }

  const templatePrompt = templateId
    ? (await query<{ prompt: string }>(
        `select prompt
         from public.weekly_report_templates
         where id = $1
           and coalesce(operating_unit_slug, $2) = $2
         limit 1`,
        [templateId, DEFAULT_OPERATING_UNIT_SLUG]
      ))[0]?.prompt
    : "";
  const prompt = nullableText(input.prompt) ?? nullableText(templatePrompt);

  const [updated] = await query<WeeklyReportCycle>(
    `update public.weekly_report_cycles
     set
       template_id = $2::uuid,
       title = $3,
       week_label = $4,
       start_date = $5::date,
       due_date = $6::date,
       prompt = $7,
       updated_at = now()
     where id = $1
       and coalesce(operating_unit_slug, $8) = $8
     returning
       id,
       template_id as "templateId",
       title,
       week_label as "weekLabel",
       start_date::text as "startDate",
       due_date::text as "dueDate",
       prompt,
       status,
       0 as "reportCount",
       created_at::text as "createdAt"`,
    [
      id,
      templateId || null,
      title,
      weekLabel,
      normalizeDate(input.startDate),
      normalizeDate(input.dueDate),
      prompt,
      DEFAULT_OPERATING_UNIT_SLUG,
    ]
  );

  if (!updated) {
    throw new Error("주간 보고를 수정할 수 없습니다.");
  }

  return updated;
}

export async function listWeeklyReportCycles(): Promise<WeeklyReportCycle[]> {
  await ensureWeeklyReportSchema();

  return query<WeeklyReportCycle>(
    `select
       c.id,
       c.template_id as "templateId",
       c.title,
       c.week_label as "weekLabel",
       c.start_date::text as "startDate",
       c.due_date::text as "dueDate",
       c.prompt,
       c.status,
       count(r.id)::int as "reportCount",
       c.created_at::text as "createdAt"
     from public.weekly_report_cycles c
     left join public.angel_weekly_reports r on r.cycle_id = c.id
     where coalesce(c.operating_unit_slug, $1) = $1
     group by c.id
     order by c.created_at desc`,
    [DEFAULT_OPERATING_UNIT_SLUG]
  );
}

export async function getLatestOpenWeeklyReportCycle(): Promise<WeeklyReportCycle | null> {
  await ensureWeeklyReportSchema();

  const [cycle] = await query<WeeklyReportCycle>(
    `select
       c.id,
       c.template_id as "templateId",
       c.title,
       c.week_label as "weekLabel",
       c.start_date::text as "startDate",
       c.due_date::text as "dueDate",
       c.prompt,
       c.status,
       count(r.id)::int as "reportCount",
       c.created_at::text as "createdAt"
     from public.weekly_report_cycles c
     left join public.angel_weekly_reports r on r.cycle_id = c.id
     where c.status = 'open'
       and coalesce(c.operating_unit_slug, $1) = $1
     group by c.id
     order by c.created_at desc
     limit 1`,
    [DEFAULT_OPERATING_UNIT_SLUG]
  );

  return cycle ?? null;
}

export async function getWeeklyReportCycleById(
  cycleId: string
): Promise<WeeklyReportCycle | null> {
  await ensureWeeklyReportSchema();

  const [cycle] = await query<WeeklyReportCycle>(
    `select
       c.id,
       c.template_id as "templateId",
       c.title,
       c.week_label as "weekLabel",
       c.start_date::text as "startDate",
       c.due_date::text as "dueDate",
       c.prompt,
       c.status,
       count(r.id)::int as "reportCount",
       c.created_at::text as "createdAt"
     from public.weekly_report_cycles c
     left join public.angel_weekly_reports r on r.cycle_id = c.id
     where c.id = $1
       and coalesce(c.operating_unit_slug, $2) = $2
     group by c.id
     limit 1`,
    [cycleId, DEFAULT_OPERATING_UNIT_SLUG]
  );

  return cycle ?? null;
}

export async function listAngelWeeklyReports(
  cycleId: string
): Promise<AngelWeeklyReport[]> {
  await ensureWeeklyReportSchema();

  return query<AngelWeeklyReport>(
    `select
       id,
       cycle_id as "cycleId",
       angel_name as "angelName",
       team_name as "teamName",
       summary,
       notes,
       requests,
       action_items as "actionItems",
       submitted_at::text as "submittedAt",
       updated_at::text as "updatedAt"
     from public.angel_weekly_reports
     where cycle_id = $1
     order by updated_at desc, team_name asc, angel_name asc`,
    [cycleId]
  );
}

export async function listWeeklyReportOverview(
  limit = 6
): Promise<WeeklyReportCycleWithReports[]> {
  const cycles = await listWeeklyReportCycles();
  const limitedCycles = cycles.slice(0, limit);
  const reportsByCycle = await Promise.all(
    limitedCycles.map((cycle) => listAngelWeeklyReports(cycle.id))
  );

  return limitedCycles.map((cycle, index) => ({
    ...cycle,
    reports: reportsByCycle[index] ?? [],
  }));
}

export async function upsertAngelWeeklyReport(
  input: UpsertAngelWeeklyReportInput
): Promise<AngelWeeklyReport> {
  await ensureWeeklyReportSchema();

  const cycleId = cleanText(input.cycleId);
  const angelName = cleanText(input.angelName);
  const teamName = cleanText(input.teamName);
  const summary = cleanText(input.summary);

  if (!cycleId || !angelName || !teamName || !summary) {
    throw new Error("주차, 엔젤, 팀, 팀 현황 요약은 필수입니다.");
  }

  const [report] = await query<AngelWeeklyReport>(
    `insert into public.angel_weekly_reports (
       id, cycle_id, angel_name, team_name, summary, notes, requests, action_items
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (cycle_id, angel_name, team_name)
     do update set
       summary = excluded.summary,
       notes = excluded.notes,
       requests = excluded.requests,
       action_items = excluded.action_items,
       updated_at = now()
     returning
       id,
       cycle_id as "cycleId",
       angel_name as "angelName",
       team_name as "teamName",
       summary,
       notes,
       requests,
       action_items as "actionItems",
       submitted_at::text as "submittedAt",
       updated_at::text as "updatedAt"`,
    [
      randomUUID(),
      cycleId,
      angelName,
      teamName,
      summary,
      nullableText(input.notes),
      nullableText(input.requests),
      nullableText(input.actionItems),
    ]
  );

  if (!report) {
    throw new Error("엔젤 주간 보고를 저장할 수 없습니다.");
  }

  return report;
}

export async function listComments(
  reportId: string
): Promise<WeeklyReportComment[]> {
  await ensureWeeklyReportSchema();

  const id = cleanText(reportId);
  if (!id) {
    throw new Error("보고서 ID는 필수입니다.");
  }

  return query<WeeklyReportComment>(
    `select
       id,
       report_id as "reportId",
       author_role as "authorRole",
       author_label as "authorLabel",
       body,
       created_at::text as "createdAt"
     from public.weekly_report_comments
     where report_id = $1
       and deleted_at is null
     order by created_at asc`,
    [id]
  );
}

export async function addComment(
  input: AddWeeklyReportCommentInput
): Promise<WeeklyReportComment> {
  await ensureWeeklyReportSchema();

  if (!VALID_AUTHOR_ROLES.includes(input.authorRole)) {
    throw new Error("유효하지 않은 작성자 역할입니다.");
  }

  const reportId = cleanText(input.reportId);
  const authorLabel = cleanText(input.authorLabel);
  const body = cleanText(input.body);

  if (!reportId) {
    throw new Error("보고서 ID는 필수입니다.");
  }
  if (!authorLabel) {
    throw new Error("작성자 표시 이름은 필수입니다.");
  }
  if (authorLabel.length > 100) {
    throw new Error("작성자 표시명이 너무 깁니다.");
  }
  if (!body) {
    throw new Error("댓글 내용은 필수입니다.");
  }
  if (body.length > 4000) {
    throw new Error("댓글 내용이 너무 깁니다.");
  }

  const [created] = await query<WeeklyReportComment>(
    `insert into public.weekly_report_comments (
       id, report_id, author_role, author_label, body
     )
     values ($1, $2, $3, $4, $5)
     returning
       id,
       report_id as "reportId",
       author_role as "authorRole",
       author_label as "authorLabel",
       body,
       created_at::text as "createdAt"`,
    [randomUUID(), reportId, input.authorRole, authorLabel, body]
  );

  if (!created) {
    throw new Error("댓글을 저장할 수 없습니다.");
  }

  return created;
}

export async function softDeleteComment(commentId: string): Promise<void> {
  await ensureWeeklyReportSchema();

  const id = cleanText(commentId);
  if (!id) {
    throw new Error("댓글 ID는 필수입니다.");
  }

  await query(
    `update public.weekly_report_comments
     set deleted_at = now()
     where id = $1
       and deleted_at is null`,
    [id]
  );
}
