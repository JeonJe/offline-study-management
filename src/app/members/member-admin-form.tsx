"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  SpecialParticipantRole,
  SpecialRoleDirectory,
  TeamMemberEntry,
  TeamMemberGroup,
} from "@/lib/member-store";
import { PARTICIPANT_ROLE_META } from "@/lib/participant-role-utils";

type MemberAdminFormProps = {
  initialFixedAngels: string[];
  initialTeamGroups: TeamMemberGroup[];
  initialSpecialRoles: SpecialRoleDirectory;
};

type TeamDraft = {
  id: string;
  teamName: string;
  angels: string[];
  angelInput: string;
  members: TeamMemberEntry[];
  memberInput: string;
};

type OperationRole = "angel" | SpecialParticipantRole;

function generateTeamId(): string {
  return `team-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function generateMemberId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `member-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function uniq(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function parseNames(raw: string): string[] {
  return uniq(raw.split(/[\n,;]+/));
}

function createMemberEntries(names: string[]): TeamMemberEntry[] {
  return names.map((name, order) => ({
    id: generateMemberId(),
    name,
    order,
  }));
}

const SPECIAL_PARTICIPANT_ROLES: SpecialParticipantRole[] = [
  "supporter",
  "buddy",
  "mentor",
  "manager",
];
const OPERATION_ROLE_ORDER: OperationRole[] = ["angel", "mentor", "manager", "supporter", "buddy"];

function RemoveChipButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[11px] leading-none transition hover:bg-black/10"
    >
      ×
    </button>
  );
}

export function MemberAdminForm({
  initialFixedAngels,
  initialTeamGroups,
  initialSpecialRoles,
}: MemberAdminFormProps) {
  const [fixedAngels, setFixedAngels] = useState<string[]>(uniq(initialFixedAngels));
  const [teams, setTeams] = useState<TeamDraft[]>(
    initialTeamGroups.map((team) => ({
      id: generateTeamId(),
      teamName: team.teamName,
      angels: uniq(team.angels ?? []),
      angelInput: "",
      members:
        team.memberEntries && team.memberEntries.length > 0
          ? team.memberEntries.map((member, order) => ({
              id: member.id || generateMemberId(),
              name: member.name,
              order,
            }))
          : createMemberEntries(uniq(team.members)),
      memberInput: "",
    }))
  );
  const [specialRoles, setSpecialRoles] = useState<SpecialRoleDirectory>({
    supporter: uniq(initialSpecialRoles.supporter ?? []),
    buddy: uniq(initialSpecialRoles.buddy ?? []),
    mentor: uniq(initialSpecialRoles.mentor ?? []),
    manager: uniq(initialSpecialRoles.manager ?? []),
  });
  const [activeOperationRole, setActiveOperationRole] = useState<OperationRole>("angel");
  const [operationInput, setOperationInput] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);
  const [pendingAngelManageIndex, setPendingAngelManageIndex] = useState<number | null>(null);
  const [pendingMemberManageIndex, setPendingMemberManageIndex] = useState<number | null>(null);
  const [operationAddOpen, setOperationAddOpen] = useState(false);
  const [teamAddOpen, setTeamAddOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamAngels, setNewTeamAngels] = useState("");
  const [newTeamMembers, setNewTeamMembers] = useState("");
  const initialRenderRef = useRef(true);
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const totalTeamMemberCount = useMemo(
    () => teams.reduce((sum, team) => sum + team.members.length, 0),
    [teams]
  );

  const payload = useMemo(
    () => ({
      fixedAngels: uniq(fixedAngels),
      teamGroups: teams.map((team) => ({
        teamName: team.teamName.trim(),
        angels: uniq(team.angels).slice(0, 2),
        memberEntries: team.members.map((member, order) => ({
          id: member.id,
          name: member.name.trim(),
          order,
        })),
        members: team.members.map((member) => member.name.trim()).filter(Boolean),
      })),
      specialRoles: Object.fromEntries(
        SPECIAL_PARTICIPANT_ROLES.map((role) => [role, uniq(specialRoles[role] ?? [])])
      ) as SpecialRoleDirectory,
    }),
    [fixedAngels, teams, specialRoles]
  );
  const latestPayloadRef = useRef(payload);

  const canAutoSave = useMemo(() => {
    if (payload.fixedAngels.length === 0) return false;
    if (payload.teamGroups.length === 0) return false;
    return payload.teamGroups.every((team) => team.teamName.length > 0 && team.angels.length > 0);
  }, [payload]);

  useEffect(() => {
    latestPayloadRef.current = payload;
  }, [payload]);

  const saveNow = useCallback(async () => {
    if (savingRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    savingRef.current = true;
    pendingSaveRef.current = false;
    setSaving(true);
    setSaveState("idle");

    try {
      const response = await fetch("/api/members/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(latestPayloadRef.current),
      });
      setSaveState(response.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
    } finally {
      savingRef.current = false;
      setSaving(false);
      if (pendingSaveRef.current) {
        void saveNow();
      }
    }
  }, []);

  useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      return;
    }

    if (!canAutoSave) {
      setSaveState("idle");
      return;
    }

    const timer = setTimeout(() => {
      void saveNow();
    }, 350);

    return () => clearTimeout(timer);
  }, [canAutoSave, payload, saveNow]);

  function updateTeam(index: number, updater: (team: TeamDraft) => TeamDraft): void {
    setTeams((prev) => prev.map((team, i) => (i === index ? updater(team) : team)));
  }

  const addTeam = useCallback((input?: { teamName?: string; angels?: string; members?: string }): void => {
    setTeams((prev) => [
      ...prev,
      {
        id: generateTeamId(),
        teamName: input?.teamName?.trim() || `${prev.length + 1}팀`,
        angels: uniq(parseNames(input?.angels ?? "")).slice(0, 2),
        angelInput: "",
        members: createMemberEntries(parseNames(input?.members ?? "")),
        memberInput: "",
      },
    ]);
  }, []);

  function submitNewTeam(): void {
    addTeam({
      teamName: newTeamName,
      angels: newTeamAngels,
      members: newTeamMembers,
    });
    setNewTeamName("");
    setNewTeamAngels("");
    setNewTeamMembers("");
    setTeamAddOpen(false);
  }

  function addMembers(index: number, raw: string): void {
    const names = parseNames(raw);
    if (names.length === 0) return;

    updateTeam(index, (team) => ({
      ...team,
      members: [
        ...team.members,
        ...names.map((name, offset) => ({
          id: generateMemberId(),
          name,
          order: team.members.length + offset,
        })),
      ],
      memberInput: "",
    }));
  }

  function addTeamAngels(index: number, raw: string): void {
    const names = parseNames(raw);
    if (names.length === 0) return;

    updateTeam(index, (team) => ({
      ...team,
      angels: uniq([...team.angels, ...names]).slice(0, 2),
      angelInput: "",
    }));
  }

  function addAngels(raw: string): void {
    const names = parseNames(raw);
    if (names.length === 0) return;

    setFixedAngels((prev) => uniq([...prev, ...names]));
  }

  function addSpecialRoleMembers(role: SpecialParticipantRole, raw: string): void {
    const names = parseNames(raw);
    if (names.length === 0) return;

    setSpecialRoles((prev) => ({
      ...prev,
      [role]: uniq([...(prev[role] ?? []), ...names]),
    }));
  }

  function roleMeta(role: OperationRole): {
    label: string;
    emoji: string;
    borderColor: string;
    backgroundColor: string;
    textColor: string;
  } {
    if (role === "angel") {
      return {
        label: "엔젤",
        emoji: "🪽",
        borderColor: "var(--angel-border)",
        backgroundColor: "var(--angel-bg)",
        textColor: "var(--angel-text)",
      };
    }
    return PARTICIPANT_ROLE_META[role];
  }

  function operationMembers(role: OperationRole): string[] {
    if (role === "angel") return fixedAngels;
    return specialRoles[role] ?? [];
  }

  function addOperationMembers(role: OperationRole, raw: string): void {
    if (role === "angel") {
      addAngels(raw);
      return;
    }
    addSpecialRoleMembers(role, raw);
  }

  function removeOperationMember(role: OperationRole, member: string): void {
    if (role === "angel") {
      setFixedAngels((prev) => prev.filter((name) => name !== member));
      return;
    }
    setSpecialRoles((prev) => ({
      ...prev,
      [role]: prev[role].filter((name) => name !== member),
    }));
  }

  const hasOperationNames = parseNames(operationInput).length > 0;

  return (
    <div className="mt-4 grid gap-5">
      <section className="card-static order-2 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>운영진</p>
            <p className="text-xs" style={{ color: "var(--ink-muted)" }}>역할별로 빠르게 추가/삭제</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {OPERATION_ROLE_ORDER.map((role) => {
                const meta = roleMeta(role);
                return (
                  <span
                    key={`operations-role-summary-tab-${role}`}
                    className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                    style={{ borderColor: meta.borderColor, backgroundColor: meta.backgroundColor, color: meta.textColor }}
                  >
                    {meta.label} {operationMembers(role).length}명
                  </span>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="rounded-full border px-2 py-1 text-xs font-semibold"
              style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)", color: "var(--ink-soft)" }}
            >
              {fixedAngels.length + SPECIAL_PARTICIPANT_ROLES.reduce((sum, role) => sum + (specialRoles[role]?.length ?? 0), 0)}명
            </span>
            <button
              type="button"
              className="btn-press h-9 rounded-xl border px-3 text-xs font-semibold"
              style={{ borderColor: "rgba(13, 127, 242, 0.25)", backgroundColor: "var(--accent-weak)", color: "var(--accent-strong)" }}
              onClick={() => setOperationAddOpen(true)}
            >
              운영진 추가
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {OPERATION_ROLE_ORDER.map((role) => {
              const meta = roleMeta(role);
              const members = operationMembers(role);
              return (
                <article
                  key={`operation-role-card-${role}`}
                  className="overflow-hidden rounded-2xl border bg-white"
                  style={{ borderColor: meta.borderColor }}
                >
                  <div
                    className="flex items-center justify-between gap-2 border-b px-3 py-2"
                    style={{ borderColor: meta.borderColor, backgroundColor: meta.backgroundColor }}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-sm" aria-hidden="true">{meta.emoji}</span>
                      <p className="truncate text-sm font-extrabold" style={{ color: meta.textColor }}>
                        {meta.label}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-bold" style={{ color: meta.textColor }}>
                        {members.length}명
                      </span>
                      <button
                        type="button"
                        className="btn-press rounded-lg bg-white/80 px-2 py-0.5 text-[11px] font-bold"
                        style={{ color: meta.textColor }}
                        onClick={() => {
                          setActiveOperationRole(role);
                          setOperationAddOpen(true);
                        }}
                      >
                        추가
                      </button>
                    </div>
                  </div>

                  <div className="max-h-48 min-h-24 overflow-y-auto p-2">
                    {members.length > 0 ? (
                      <ul className="grid gap-1.5">
                        {members.map((member, memberIndex) => (
                          <li
                            key={`operation-member-${role}-${member}`}
                            className="flex min-h-10 items-center justify-between gap-2 rounded-xl border px-2 py-1.5"
                            style={{ borderColor: "rgba(226, 232, 240, 0.9)", backgroundColor: "var(--surface)" }}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold"
                                style={{ backgroundColor: meta.backgroundColor, color: meta.textColor }}
                              >
                                {memberIndex + 1}
                              </span>
                              <span className="min-w-0 truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
                                {member}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="btn-press shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold"
                              style={{ borderColor: "#fecaca", color: "var(--danger)", backgroundColor: "var(--danger-bg)" }}
                              onClick={() => removeOperationMember(role, member)}
                            >
                              삭제
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="flex h-24 items-center justify-center rounded-xl border border-dashed bg-white px-3 text-center" style={{ borderColor: "var(--line)" }}>
                        <p className="text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
                          등록된 인원이 없습니다.
                        </p>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="card-static order-1 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>멤버</p>
            <span
              className="rounded-full border px-2 py-1 text-xs font-semibold"
              style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)", color: "var(--ink-soft)" }}
            >
              {teams.length}팀 / {totalTeamMemberCount}명
            </span>
          </div>
          <button
            type="button"
            className="btn-press rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: "var(--accent)", boxShadow: "0 8px 20px rgba(13, 127, 242, 0.26)" }}
            onClick={() => {
              setNewTeamName(`${teams.length + 1}팀`);
              setTeamAddOpen(true);
            }}
          >
            팀 추가
          </button>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
          {!canAutoSave ? (
            <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: "var(--angel-bg)", color: "var(--angel)" }}>
              팀명/팀 엔젤 입력 필요
            </span>
          ) : null}
          {saving ? (
            <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink-soft)" }}>
              자동 저장 중...
            </span>
          ) : null}
          {saveState === "saved" ? (
            <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: "var(--success-bg)", color: "var(--success)" }}>
              저장 완료
            </span>
          ) : null}
          {saveState === "error" ? (
            <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger)" }}>
              저장 실패
            </span>
          ) : null}
        </div>

        <div className="mt-3">
          {teams.length === 0 ? (
            <p className="rounded-xl border border-dashed px-3 py-3 text-xs" style={{ borderColor: "var(--line)", color: "var(--ink-muted)" }}>
              팀이 없습니다. 상단의 팀 추가 버튼으로 시작하세요.
            </p>
          ) : (
            <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1 stagger-children">
              {teams.map((team, index) => (
                <article key={team.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: "var(--line)" }}>
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3"
                    style={{ borderColor: "var(--line)", backgroundColor: "#f8fbff" }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={team.teamName}
                        onChange={(event) => updateTeam(index, (prev) => ({ ...prev, teamName: event.target.value }))}
                        className="h-9 w-24 rounded-xl border bg-white px-2 text-sm font-extrabold"
                        style={{ borderColor: "rgba(13, 127, 242, 0.22)", color: "var(--ink)" }}
                        placeholder="팀명"
                      />
                      <span
                        className="rounded-full border px-2 py-1 text-[11px] font-semibold"
                        style={{ borderColor: "rgba(13, 127, 242, 0.18)", backgroundColor: "var(--accent-weak)", color: "var(--accent-strong)" }}
                      >
                        엔젤 {team.angels.length}/2{team.angels.length > 0 ? ` · ${team.angels.join(", ")}` : ""}
                      </span>
                      <button
                        type="button"
                        className="btn-press h-9 rounded-xl border bg-white px-2 text-[11px] font-semibold"
                        style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
                        onClick={() => setPendingAngelManageIndex(index)}
                      >
                        엔젤 추가
                      </button>
                    </div>

                    <button
                      type="button"
                      className="btn-press h-9 rounded-xl border bg-white px-2 text-[11px] font-semibold"
                      style={{ borderColor: "#fecaca", color: "var(--danger)" }}
                      onClick={() => setPendingDeleteIndex(index)}
                    >
                      팀 삭제
                    </button>
                  </div>

                  <div className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-extrabold" style={{ color: "var(--ink)" }}>멤버 명단</p>
                        <p className="mt-0.5 text-xs" style={{ color: "var(--ink-muted)" }}>
                          팀별 참석/뒷풀이 집계에 사용하는 기본 명단입니다.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded-full border px-2 py-1 text-xs font-bold"
                          style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)", color: "var(--ink-soft)" }}
                        >
                          {team.members.length}명
                        </span>
                        <button
                          type="button"
                          className="btn-press h-9 rounded-xl border px-3 text-xs font-semibold"
                          style={{ borderColor: "rgba(13, 127, 242, 0.25)", backgroundColor: "var(--accent-weak)", color: "var(--accent-strong)" }}
                          onClick={() => setPendingMemberManageIndex(index)}
                        >
                          멤버 추가
                        </button>
                      </div>
                    </div>

                    <div
                      className="mt-3 rounded-2xl border p-2"
                      style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}
                    >
                      {team.members.length > 0 ? (
                        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {team.members.map((member, memberIndex) => (
                            <li
                              key={member.id}
                              className="flex min-h-11 items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2"
                              style={{ borderColor: "rgba(226, 232, 240, 0.9)" }}
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <span
                                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold"
                                  style={{ backgroundColor: "var(--accent-weak)", color: "var(--accent-strong)" }}
                                >
                                  {memberIndex + 1}
                                </span>
                                <span className="min-w-0 truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
                                  {member.name}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="btn-press shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold"
                                style={{ borderColor: "#fecaca", color: "var(--danger)", backgroundColor: "var(--danger-bg)" }}
                                onClick={() =>
                                  updateTeam(index, (prev) => ({
                                    ...prev,
                                    members: prev.members.filter((item) => item.id !== member.id),
                                  }))
                                }
                              >
                                삭제
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="rounded-xl border border-dashed bg-white px-4 py-6 text-center" style={{ borderColor: "var(--line)" }}>
                          <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                            아직 멤버가 없습니다.
                          </p>
                          <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
                            오른쪽 상단의 멤버 추가로 명단을 채워주세요.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <datalist id="member-fixed-angels">
        {fixedAngels.map((angel) => (
          <option key={`angel-option-${angel}`} value={angel} />
        ))}
      </datalist>

      {teamAddOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-add-modal-title"
            className="w-full max-w-lg rounded-2xl border bg-white p-5 shadow-2xl"
            style={{ borderColor: "var(--line)" }}
          >
            <h4 id="team-add-modal-title" className="text-base font-semibold" style={{ color: "var(--ink)" }}>
              팀 추가
            </h4>
            <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
              팀명과 초기 엔젤/멤버를 입력합니다. 엔젤과 멤버는 나중에 다시 수정할 수 있습니다.
            </p>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
                팀명
                <input
                  value={newTeamName}
                  onChange={(event) => setNewTeamName(event.target.value)}
                  className="h-10 rounded-xl border bg-white px-3 text-sm"
                  style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                  placeholder={`${teams.length + 1}팀`}
                  autoFocus
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
                팀 엔젤
                <input
                  value={newTeamAngels}
                  list="member-fixed-angels"
                  onChange={(event) => setNewTeamAngels(event.target.value)}
                  className="h-10 rounded-xl border bg-white px-3 text-sm"
                  style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                  placeholder="최대 2명, 쉼표로 구분"
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
                멤버
                <textarea
                  value={newTeamMembers}
                  onChange={(event) => setNewTeamMembers(event.target.value)}
                  className="min-h-28 rounded-xl border bg-white px-3 py-3 text-sm"
                  style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                  placeholder="예: 김민수, 박서준"
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-press rounded-xl border bg-white px-3 py-2 text-xs font-semibold"
                style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
                onClick={() => {
                  setNewTeamName("");
                  setNewTeamAngels("");
                  setNewTeamMembers("");
                  setTeamAddOpen(false);
                }}
              >
                취소
              </button>
              <button
                type="button"
                className="btn-press rounded-xl px-3 py-2 text-xs font-semibold text-white"
                style={{ backgroundColor: "var(--accent)" }}
                onClick={submitNewTeam}
              >
                추가
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {operationAddOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="operation-add-modal-title"
            className="w-full max-w-md rounded-2xl border bg-white p-5 shadow-2xl"
            style={{ borderColor: "var(--line)" }}
          >
            <h4 id="operation-add-modal-title" className="text-base font-semibold" style={{ color: "var(--ink)" }}>
              운영진 추가
            </h4>
            <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
              역할을 선택하고 쉼표나 Enter로 여러 명을 한 번에 추가할 수 있습니다.
            </p>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
                역할
                <select
                  value={activeOperationRole}
                  onChange={(event) => setActiveOperationRole(event.target.value as OperationRole)}
                  className="h-10 rounded-xl border bg-white px-3 text-sm font-semibold"
                  style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
                >
                  {OPERATION_ROLE_ORDER.map((role) => {
                    const meta = roleMeta(role);
                    return (
                      <option key={`operation-role-modal-option-${role}`} value={role}>
                        {meta.label}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="grid gap-1 text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
                이름
                <textarea
                  value={operationInput}
                  onChange={(event) => setOperationInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.shiftKey) return;
                    if (!hasOperationNames) return;
                    event.preventDefault();
                    addOperationMembers(activeOperationRole, operationInput);
                    setOperationInput("");
                    setOperationAddOpen(false);
                  }}
                  className="min-h-28 rounded-xl border bg-white px-3 py-3 text-sm"
                  style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                  placeholder={`${roleMeta(activeOperationRole).label} 이름 입력`}
                  autoFocus
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-press rounded-xl border bg-white px-3 py-2 text-xs font-semibold"
                style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
                onClick={() => {
                  setOperationInput("");
                  setOperationAddOpen(false);
                }}
              >
                취소
              </button>
              <button
                type="button"
                disabled={!hasOperationNames}
                className="btn-press rounded-xl px-3 py-2 text-xs font-semibold"
                style={{
                  backgroundColor: roleMeta(activeOperationRole).backgroundColor,
                  color: roleMeta(activeOperationRole).textColor,
                  opacity: hasOperationNames ? 1 : 0.45,
                }}
                onClick={() => {
                  if (!hasOperationNames) return;
                  addOperationMembers(activeOperationRole, operationInput);
                  setOperationInput("");
                  setOperationAddOpen(false);
                }}
              >
                추가
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingAngelManageIndex !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-angel-modal-title"
            className="w-full max-w-md rounded-2xl border bg-white p-5 shadow-2xl"
            style={{ borderColor: "var(--line)" }}
          >
            <h4 id="team-angel-modal-title" className="text-base font-semibold" style={{ color: "var(--ink)" }}>
              {teams[pendingAngelManageIndex]?.teamName || "팀"} 엔젤 관리
            </h4>
            <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
              최대 2명까지 등록할 수 있습니다.
            </p>

            <div
              className="mt-3 flex min-h-12 flex-wrap gap-2 rounded-xl border bg-white px-2 py-2"
              style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}
            >
              {(teams[pendingAngelManageIndex]?.angels ?? []).map((angel) => (
                <span
                  key={`angel-manage-${angel}`}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs"
                  style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)", color: "var(--ink-soft)" }}
                >
                  🪽 {angel}
                  <RemoveChipButton
                    label={`${angel} 엔젤 삭제`}
                    onClick={() =>
                      updateTeam(pendingAngelManageIndex, (prev) => ({
                        ...prev,
                        angels: prev.angels.filter((name) => name !== angel),
                      }))
                    }
                  />
                </span>
              ))}
              {(teams[pendingAngelManageIndex]?.angels ?? []).length === 0 ? (
                <span className="text-xs" style={{ color: "var(--ink-muted)" }}>등록된 엔젤 없음</span>
              ) : null}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <input
                value={teams[pendingAngelManageIndex]?.angelInput ?? ""}
                list="member-fixed-angels"
                onChange={(event) =>
                  updateTeam(pendingAngelManageIndex, (prev) => ({ ...prev, angelInput: event.target.value }))
                }
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  const currentInput = teams[pendingAngelManageIndex]?.angelInput ?? "";
                  addTeamAngels(pendingAngelManageIndex, currentInput);
                }}
                className="h-9 min-w-0 flex-1 rounded-xl border px-2 text-xs"
                style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)", color: "var(--ink-soft)" }}
                placeholder="팀 엔젤 (쉼표/Enter로 여러 명)"
              />
              <button
                type="button"
                className="btn-press h-9 rounded-xl border px-3 text-xs font-semibold"
                style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
                onClick={() => {
                  const currentInput = teams[pendingAngelManageIndex]?.angelInput ?? "";
                  addTeamAngels(pendingAngelManageIndex, currentInput);
                }}
              >
                추가
              </button>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="btn-press rounded-xl border bg-white px-3 py-2 text-xs font-semibold"
                style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
                onClick={() => setPendingAngelManageIndex(null)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingMemberManageIndex !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-member-modal-title"
            className="w-full max-w-md rounded-2xl border bg-white p-5 shadow-2xl"
            style={{ borderColor: "var(--line)" }}
          >
            <h4 id="team-member-modal-title" className="text-base font-semibold" style={{ color: "var(--ink)" }}>
              {teams[pendingMemberManageIndex]?.teamName || "팀"} 멤버 추가
            </h4>
            <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
              쉼표나 줄바꿈으로 여러 명을 한 번에 추가할 수 있습니다.
            </p>

            <textarea
              value={teams[pendingMemberManageIndex]?.memberInput ?? ""}
              onChange={(event) =>
                updateTeam(pendingMemberManageIndex, (prev) => ({ ...prev, memberInput: event.target.value }))
              }
              className="mt-3 min-h-28 w-full rounded-xl border px-3 py-3 text-sm"
              style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)", color: "var(--ink)" }}
              placeholder="예: 김민수, 박서준"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-press rounded-xl border bg-white px-3 py-2 text-xs font-semibold"
                style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
                onClick={() => setPendingMemberManageIndex(null)}
              >
                취소
              </button>
              <button
                type="button"
                className="btn-press rounded-xl px-3 py-2 text-xs font-semibold text-white"
                style={{ backgroundColor: "var(--accent)" }}
                onClick={() => {
                  const currentInput = teams[pendingMemberManageIndex]?.memberInput ?? "";
                  addMembers(pendingMemberManageIndex, currentInput);
                  setPendingMemberManageIndex(null);
                }}
              >
                추가
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingDeleteIndex !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-delete-modal-title"
            className="w-full max-w-sm rounded-2xl border bg-white p-5 shadow-2xl"
            style={{ borderColor: "var(--line)" }}
          >
            <h4 id="team-delete-modal-title" className="text-base font-semibold" style={{ color: "var(--ink)" }}>팀 삭제 확인</h4>
            <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
              `{teams[pendingDeleteIndex]?.teamName ?? "선택 팀"}`을(를) 삭제합니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-press rounded-xl border bg-white px-3 py-2 text-xs font-semibold"
                style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
                onClick={() => setPendingDeleteIndex(null)}
              >
                취소
              </button>
              <button
                type="button"
                className="btn-press rounded-xl px-3 py-2 text-xs font-semibold text-white"
                style={{ backgroundColor: "var(--danger)" }}
                onClick={() => {
                  setTeams((prev) => prev.filter((_, i) => i !== pendingDeleteIndex));
                  setPendingDeleteIndex(null);
                }}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
