"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  SpecialParticipantRole,
  SpecialRoleDirectory,
  TeamMemberEntry,
  TeamMemberGroup,
} from "@/lib/member-store";
import { saveMemberPresetAction } from "@/app/members/member-actions";
import { MemberSaveToolbar } from "@/app/members/member-save-toolbar";
import { MemberEditModal } from "@/app/members/_components/member-edit-modal";
import { TeamEditModal } from "@/app/members/_components/team-edit-modal";
import { PARTICIPANT_ROLE_META } from "@/lib/participant-role-utils";

type MemberAdminFormProps = {
  operatingUnitSlug: string;
  initialFixedAngels: string[];
  initialTeamGroups: TeamMemberGroup[];
  initialSpecialRoles: SpecialRoleDirectory;
};

type TeamDraft = {
  id: string;
  teamName: string;
  angels: string[];
  members: TeamMemberEntry[];
};

type OperationRole = "angel" | SpecialParticipantRole;
type MemberEditTarget = {
  teamIndex: number;
  memberId: string;
} | null;

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

export function MemberAdminForm({
  operatingUnitSlug,
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
      members:
        team.memberEntries && team.memberEntries.length > 0
          ? team.memberEntries.map((member, order) => ({
              id: member.id || generateMemberId(),
              name: member.name,
              order,
            }))
          : createMemberEntries(uniq(team.members)),
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
  const [pendingMemberManageIndex, setPendingMemberManageIndex] = useState<number | null>(null);
  const [pendingTeamEditIndex, setPendingTeamEditIndex] = useState<number | null>(null);
  const [pendingMemberEdit, setPendingMemberEdit] = useState<MemberEditTarget>(null);
  const [operationAddOpen, setOperationAddOpen] = useState(false);
  const [teamAddOpen, setTeamAddOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamAngels, setNewTeamAngels] = useState("");
  const [newTeamMembers, setNewTeamMembers] = useState("");
  const [memberAddInput, setMemberAddInput] = useState("");
  const [teamEditName, setTeamEditName] = useState("");
  const [teamEditAngels, setTeamEditAngels] = useState<string[]>([]);
  const [teamEditAngelInput, setTeamEditAngelInput] = useState("");
  const [memberEditName, setMemberEditName] = useState("");
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

  const canSave = useMemo(() => {
    if (payload.fixedAngels.length === 0) return false;
    if (payload.teamGroups.length === 0) return false;
    return payload.teamGroups.every((team) => team.teamName.length > 0 && team.angels.length > 0);
  }, [payload]);

  const saveNow = useCallback(async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setSaveState("idle");

    try {
      const result = await saveMemberPresetAction({
        ...payload,
        operatingUnitSlug,
      });
      setSaveState(result.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
    } finally {
      setSaving(false);
    }
  }, [canSave, operatingUnitSlug, payload, saving]);

  function updateTeam(index: number, updater: (team: TeamDraft) => TeamDraft): void {
    setTeams((prev) => prev.map((team, i) => (i === index ? updater(team) : team)));
    setSaveState("idle");
  }

  const addTeam = useCallback((input?: { teamName?: string; angels?: string; members?: string }): void => {
    setTeams((prev) => [
      ...prev,
      {
        id: generateTeamId(),
        teamName: input?.teamName?.trim() || `${prev.length + 1}팀`,
        angels: uniq(parseNames(input?.angels ?? "")).slice(0, 2),
        members: createMemberEntries(parseNames(input?.members ?? "")),
      },
    ]);
    setSaveState("idle");
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
    }));
  }

  function addAngels(raw: string): void {
    const names = parseNames(raw);
    if (names.length === 0) return;

    setFixedAngels((prev) => uniq([...prev, ...names]));
    setSaveState("idle");
  }

  function addSpecialRoleMembers(role: SpecialParticipantRole, raw: string): void {
    const names = parseNames(raw);
    if (names.length === 0) return;

    setSpecialRoles((prev) => ({
      ...prev,
      [role]: uniq([...(prev[role] ?? []), ...names]),
    }));
    setSaveState("idle");
  }

  function roleMeta(role: OperationRole): {
    label: string;
    emoji: string;
    accentColor: string;
    borderColor: string;
    backgroundColor: string;
    textColor: string;
  } {
    if (role === "angel") {
      return {
        label: "엔젤",
        emoji: "",
        accentColor: "#2563eb",
        borderColor: "var(--line)",
        backgroundColor: "#f8fbff",
        textColor: "var(--ink-soft)",
      };
    }
    const meta = PARTICIPANT_ROLE_META[role];
    const accentColorByRole: Record<SpecialParticipantRole, string> = {
      mentor: "#7c3aed",
      manager: "#0f766e",
      supporter: "#2563eb",
      buddy: "#15803d",
    };
    return {
      ...meta,
      emoji: "",
      accentColor: accentColorByRole[role],
      borderColor: "var(--line)",
      backgroundColor: "#f8fbff",
      textColor: "var(--ink-soft)",
    };
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
      setSaveState("idle");
      return;
    }
    setSpecialRoles((prev) => ({
      ...prev,
      [role]: prev[role].filter((name) => name !== member),
    }));
    setSaveState("idle");
  }

  function openTeamEdit(index: number): void {
    const team = teams[index];
    if (!team) return;
    setTeamEditName(team.teamName);
    setTeamEditAngels(team.angels);
    setTeamEditAngelInput("");
    setPendingTeamEditIndex(index);
  }

  function submitTeamEdit(): void {
    if (pendingTeamEditIndex === null) return;
    updateTeam(pendingTeamEditIndex, (team) => ({
      ...team,
      teamName: teamEditName.trim() || team.teamName,
      angels: uniq(teamEditAngels).slice(0, 2),
    }));
    setPendingTeamEditIndex(null);
    setTeamEditName("");
    setTeamEditAngels([]);
    setTeamEditAngelInput("");
  }

  function addTeamEditAngel(): void {
    const angel = teamEditAngelInput.trim();
    if (!angel || teamEditAngels.includes(angel) || teamEditAngels.length >= 2) return;
    setTeamEditAngels((prev) => [...prev, angel]);
    setTeamEditAngelInput("");
  }

  function openMemberEdit(teamIndex: number, member: TeamMemberEntry): void {
    setPendingMemberEdit({ teamIndex, memberId: member.id });
    setMemberEditName(member.name);
  }

  function submitMemberEdit(): void {
    if (!pendingMemberEdit) return;
    const nextName = memberEditName.trim();
    if (!nextName) return;
    updateTeam(pendingMemberEdit.teamIndex, (team) => ({
      ...team,
      members: team.members.map((member) =>
        member.id === pendingMemberEdit.memberId ? { ...member, name: nextName } : member
      ),
    }));
    setPendingMemberEdit(null);
    setMemberEditName("");
  }

  function deleteEditingMember(): void {
    if (!pendingMemberEdit) return;
    updateTeam(pendingMemberEdit.teamIndex, (team) => ({
      ...team,
      members: team.members.filter((member) => member.id !== pendingMemberEdit.memberId),
    }));
    setPendingMemberEdit(null);
    setMemberEditName("");
  }

  const hasOperationNames = parseNames(operationInput).length > 0;

  return (
    <div className="mt-4 grid gap-5">
      <section className="app-section order-2 p-5 sm:p-6">
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
                    className="inline-flex items-center gap-1.5 rounded-full border bg-white px-2 py-0.5 text-[11px] font-semibold"
                    style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.accentColor }} aria-hidden="true" />
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

        <div className="list-surface mt-3 p-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {OPERATION_ROLE_ORDER.map((role) => {
              const meta = roleMeta(role);
              const members = operationMembers(role);
              return (
                <article
                  key={`operation-role-card-${role}`}
                  className="overflow-hidden rounded-2xl border border-t-[3px] bg-white"
                  style={{ borderColor: "var(--line)", borderTopColor: meta.accentColor }}
                >
                  <div
                    className="flex items-center justify-between gap-2 border-b px-3 py-2"
                    style={{ borderColor: "var(--line)", backgroundColor: "#ffffff" }}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.accentColor }} aria-hidden="true" />
                      <p className="truncate text-sm font-extrabold" style={{ color: meta.textColor }}>
                        {meta.label}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="rounded-full border px-2 py-0.5 text-[11px] font-bold" style={{ borderColor: "var(--line)", color: "var(--ink-muted)" }}>
                        {members.length}명
                      </span>
                      <button
                        type="button"
                        className="btn-press rounded-lg border px-2 py-0.5 text-[11px] font-bold"
                        style={{ borderColor: "var(--line)", color: "var(--ink-soft)", backgroundColor: "var(--surface)" }}
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
                                style={{ backgroundColor: "var(--surface-alt)", color: "var(--ink-muted)" }}
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

      <section className="app-section order-1 p-5 sm:p-6">
        <MemberSaveToolbar
          teamCount={teams.length}
          memberCount={totalTeamMemberCount}
          canSave={canSave}
          saving={saving}
          saveState={saveState}
          onAddTeam={() => {
            setNewTeamName(`${teams.length + 1}팀`);
            setTeamAddOpen(true);
          }}
          onSave={() => void saveNow()}
        />

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
                    className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
                    style={{ borderColor: "var(--line)", backgroundColor: "#f8fbff" }}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-extrabold" style={{ color: "var(--ink)" }}>
                          {team.teamName || "이름 없는 팀"}
                        </p>
                        <span className="text-xs font-semibold" style={{ color: "var(--ink-muted)" }}>
                          멤버 {team.members.length}명
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs" style={{ color: "var(--ink-soft)" }}>
                        담당 엔젤 {team.angels.length > 0 ? team.angels.join(", ") : "미지정"}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="btn-press h-9 rounded-xl border bg-white px-3 text-xs font-semibold"
                        style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
                        onClick={() => openTeamEdit(index)}
                      >
                        팀 수정
                      </button>
                      <button
                        type="button"
                        className="btn-press h-9 rounded-xl border bg-white px-3 text-xs font-semibold"
                        style={{ borderColor: "#fecaca", color: "var(--danger)" }}
                        onClick={() => setPendingDeleteIndex(index)}
                      >
                        팀 삭제
                      </button>
                    </div>
                  </div>

                  <div className="p-4">
                    <div
                      className="list-surface p-3"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
                          멤버
                        </p>
                        <button
                          type="button"
                          className="btn-press h-9 rounded-xl border px-3 text-xs font-semibold"
                          style={{ borderColor: "rgba(13, 127, 242, 0.25)", backgroundColor: "var(--accent-weak)", color: "var(--accent-strong)" }}
                          onClick={() => {
                            setMemberAddInput("");
                            setPendingMemberManageIndex(index);
                          }}
                        >
                          멤버 추가
                        </button>
                      </div>
                      {team.members.length > 0 ? (
                        <ul className="grid overflow-hidden rounded-xl border bg-white sm:grid-cols-2 lg:grid-cols-3" style={{ borderColor: "var(--line)" }}>
                          {team.members.map((member, memberIndex) => (
                            <li
                              key={member.id}
                              className="flex min-h-11 items-center justify-between gap-3 border-b px-3 py-2 sm:border-r"
                              style={{ borderColor: "var(--line)" }}
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
                                style={{ borderColor: "var(--line)", color: "var(--ink-soft)", backgroundColor: "var(--surface)" }}
                                onClick={() => openMemberEdit(index, member)}
                              >
                                수정
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
            className="modal-surface w-full max-w-lg p-5"
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
            className="modal-surface w-full max-w-md p-5"
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

      <TeamEditModal
        open={pendingTeamEditIndex !== null}
        fixedAngels={fixedAngels}
        teamName={teamEditName}
        teamAngels={teamEditAngels}
        teamAngelInput={teamEditAngelInput}
        onTeamNameChange={setTeamEditName}
        onTeamAngelsChange={setTeamEditAngels}
        onTeamAngelInputChange={setTeamEditAngelInput}
        onAddAngel={addTeamEditAngel}
        onCancel={() => {
          setPendingTeamEditIndex(null);
          setTeamEditName("");
          setTeamEditAngels([]);
          setTeamEditAngelInput("");
        }}
        onSubmit={submitTeamEdit}
      />

      {pendingMemberManageIndex !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-member-modal-title"
            className="modal-surface w-full max-w-md p-5"
          >
            <h4 id="team-member-modal-title" className="text-base font-semibold" style={{ color: "var(--ink)" }}>
              {teams[pendingMemberManageIndex]?.teamName || "팀"} 멤버 추가
            </h4>
            <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
              쉼표나 줄바꿈으로 여러 명을 한 번에 추가할 수 있습니다.
            </p>

            <textarea
              value={memberAddInput}
              onChange={(event) => setMemberAddInput(event.target.value)}
              className="mt-3 min-h-28 w-full rounded-xl border px-3 py-3 text-sm"
              style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)", color: "var(--ink)" }}
              placeholder="예: 김민수, 박서준"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-press rounded-xl border bg-white px-3 py-2 text-xs font-semibold"
                style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
                onClick={() => {
                  setMemberAddInput("");
                  setPendingMemberManageIndex(null);
                }}
              >
                취소
              </button>
              <button
                type="button"
                className="btn-press rounded-xl px-3 py-2 text-xs font-semibold text-white"
                style={{ backgroundColor: "var(--accent)" }}
                onClick={() => {
                  addMembers(pendingMemberManageIndex, memberAddInput);
                  setMemberAddInput("");
                  setPendingMemberManageIndex(null);
                }}
              >
                추가
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <MemberEditModal
        open={pendingMemberEdit !== null}
        memberName={memberEditName}
        canSubmit={memberEditName.trim().length > 0}
        onMemberNameChange={setMemberEditName}
        onCancel={() => {
          setPendingMemberEdit(null);
          setMemberEditName("");
        }}
        onDelete={deleteEditingMember}
        onSubmit={submitMemberEdit}
      />

      {pendingDeleteIndex !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-delete-modal-title"
            className="modal-surface w-full max-w-sm p-5"
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
