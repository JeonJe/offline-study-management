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
import { LoadingSpinner } from "@/app/pending-submit-button";
import { TeamEditModal } from "@/app/members/_components/team-edit-modal";
import { PARTICIPANT_ROLE_META } from "@/lib/participant-role-utils";
import { ToastNotice } from "@/app/toast-notice";

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
type ToastState = {
  id: number;
  message: string;
  tone?: "success" | "danger";
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

function buildMemberPayload(
  nextFixedAngels: string[],
  nextTeams: TeamDraft[],
  nextSpecialRoles: SpecialRoleDirectory
) {
  const teamGroups = nextTeams.map((team) => ({
    teamName: team.teamName.trim(),
    angels: uniq(team.angels).slice(0, 2),
    memberEntries: team.members
      .map((member, order) => ({
        id: member.id,
        name: member.name.trim(),
        order,
      }))
      .filter((member) => member.name.length > 0),
    members: team.members.map((member) => member.name.trim()).filter(Boolean),
  }));
  return {
    fixedAngels: uniq([
      ...nextFixedAngels,
      ...teamGroups.flatMap((team) => team.angels),
    ]),
    teamGroups,
    specialRoles: Object.fromEntries(
      SPECIAL_PARTICIPANT_ROLES.map((role) => [role, uniq(nextSpecialRoles[role] ?? [])])
    ) as SpecialRoleDirectory,
  };
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
  const [operationEditDrafts, setOperationEditDrafts] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [pendingTeamEditIndex, setPendingTeamEditIndex] = useState<number | null>(null);
  const [operationAddOpen, setOperationAddOpen] = useState(false);
  const [teamAddOpen, setTeamAddOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamAngels, setNewTeamAngels] = useState("");
  const [newTeamMembers, setNewTeamMembers] = useState("");
  const [teamEditName, setTeamEditName] = useState("");
  const [teamEditAngels, setTeamEditAngels] = useState<string[]>([]);
  const [teamEditMembers, setTeamEditMembers] = useState<string[]>([]);
  const [teamEditAngelInput, setTeamEditAngelInput] = useState("");
  const [teamEditMemberInput, setTeamEditMemberInput] = useState("");
  const totalTeamMemberCount = useMemo(
    () => teams.reduce((sum, team) => sum + team.members.length, 0),
    [teams]
  );
  const teamAssignedAngelSet = useMemo(
    () => new Set(teams.flatMap((team) => team.angels.map((name) => name.trim()).filter(Boolean))),
    [teams]
  );

  const showToast = useCallback((message: string, tone?: "success" | "danger") => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  const persist = useCallback(async (
    nextFixedAngels: string[],
    nextTeams: TeamDraft[],
    nextSpecialRoles: SpecialRoleDirectory,
    successMessage: string
  ) => {
    const nextPayload = buildMemberPayload(nextFixedAngels, nextTeams, nextSpecialRoles);
    if (nextPayload.teamGroups.length === 0 || nextPayload.teamGroups.some((team) => !team.teamName || team.angels.length === 0)) {
      showToast("저장 실패", "danger");
      return false;
    }

    setSaving(true);

    try {
      const result = await saveMemberPresetAction({
        ...nextPayload,
        operatingUnitSlug,
      });
      showToast(result.ok ? successMessage : "저장 실패", result.ok ? "success" : "danger");
      return result.ok;
    } catch {
      showToast("저장 실패", "danger");
      return false;
    } finally {
      setSaving(false);
    }
  }, [operatingUnitSlug, showToast]);

  function submitNewTeam(): void {
    if (saving) return;
    const angels = uniq(parseNames(newTeamAngels)).slice(0, 2);
    const team: TeamDraft = {
      id: generateTeamId(),
      teamName: newTeamName.trim() || `${teams.length + 1}팀`,
      angels,
      members: createMemberEntries(parseNames(newTeamMembers)),
    };
    const nextTeams = [...teams, team];
    const nextFixedAngels = uniq([...fixedAngels, ...angels]);
    setTeams(nextTeams);
    setFixedAngels(nextFixedAngels);
    void persist(nextFixedAngels, nextTeams, specialRoles, "생성 완료");
    setNewTeamName("");
    setNewTeamAngels("");
    setNewTeamMembers("");
    setTeamAddOpen(false);
  }

  function addAngels(raw: string): void {
    if (saving) return;
    const names = parseNames(raw);
    if (names.length === 0) return;

    const nextFixedAngels = uniq([...fixedAngels, ...names]);
    setFixedAngels(nextFixedAngels);
    void persist(nextFixedAngels, teams, specialRoles, "추가 완료");
  }

  function addSpecialRoleMembers(role: SpecialParticipantRole, raw: string): void {
    if (saving) return;
    const names = parseNames(raw);
    if (names.length === 0) return;

    const nextSpecialRoles = {
      ...specialRoles,
      [role]: uniq([...(specialRoles[role] ?? []), ...names]),
    };
    setSpecialRoles(nextSpecialRoles);
    void persist(fixedAngels, teams, nextSpecialRoles, "추가 완료");
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
    if (saving) return;
    if (role === "angel") {
      if (teamAssignedAngelSet.has(member)) {
        showToast("팀에서 수정하세요", "danger");
        return;
      }
      const nextFixedAngels = fixedAngels.filter((name) => name !== member);
      setFixedAngels(nextFixedAngels);
      setOperationEditDrafts((prev) => {
        const next = { ...prev };
        delete next[member];
        return next;
      });
      void persist(nextFixedAngels, teams, specialRoles, "삭제 완료");
      return;
    }
    const nextSpecialRoles = {
      ...specialRoles,
      [role]: specialRoles[role].filter((name) => name !== member),
    };
    setSpecialRoles(nextSpecialRoles);
    setOperationEditDrafts((prev) => {
      const next = { ...prev };
      delete next[member];
      return next;
    });
    void persist(fixedAngels, teams, nextSpecialRoles, "삭제 완료");
  }

  function updateOperationMember(role: OperationRole, currentName: string): void {
    if (saving) return;
    const nextName = (operationEditDrafts[currentName] ?? currentName).trim();
    if (!nextName) {
      showToast("수정 실패", "danger");
      return;
    }
    if (nextName === currentName) return;

    if (role === "angel") {
      if (teamAssignedAngelSet.has(currentName)) {
        showToast("팀에서 수정하세요", "danger");
        return;
      }
      const nextFixedAngels = uniq(fixedAngels.map((name) => (name === currentName ? nextName : name)));
      setFixedAngels(nextFixedAngels);
      setOperationEditDrafts((prev) => {
        const next = { ...prev };
        delete next[currentName];
        next[nextName] = nextName;
        return next;
      });
      void persist(nextFixedAngels, teams, specialRoles, "수정 완료");
      return;
    }

    const nextSpecialRoles = {
      ...specialRoles,
      [role]: uniq(specialRoles[role].map((name) => (name === currentName ? nextName : name))),
    };
    setSpecialRoles(nextSpecialRoles);
    setOperationEditDrafts((prev) => {
      const next = { ...prev };
      delete next[currentName];
      next[nextName] = nextName;
      return next;
    });
    void persist(fixedAngels, teams, nextSpecialRoles, "수정 완료");
  }

  function openTeamEdit(index: number): void {
    const team = teams[index];
    if (!team) return;
    setTeamEditName(team.teamName);
    setTeamEditAngels(team.angels);
    setTeamEditMembers(team.members.map((member) => member.name));
    setTeamEditAngelInput("");
    setTeamEditMemberInput("");
    setPendingTeamEditIndex(index);
  }

  function submitTeamEdit(): void {
    if (saving) return;
    if (pendingTeamEditIndex === null) return;
    const nextTeams = teams.map((team, index) => {
      if (index !== pendingTeamEditIndex) return team;
      return {
        ...team,
        teamName: teamEditName.trim() || team.teamName,
        angels: uniq(teamEditAngels).slice(0, 2),
        members: createMemberEntries(uniq(teamEditMembers)),
      };
    });
    const nextFixedAngels = uniq([...fixedAngels, ...teamEditAngels]);
    setTeams(nextTeams);
    setFixedAngels(nextFixedAngels);
    void persist(nextFixedAngels, nextTeams, specialRoles, "저장 완료");
    setPendingTeamEditIndex(null);
    setTeamEditName("");
    setTeamEditAngels([]);
    setTeamEditMembers([]);
    setTeamEditAngelInput("");
    setTeamEditMemberInput("");
  }

  function addTeamEditAngel(): void {
    const angel = teamEditAngelInput.trim();
    if (!angel || teamEditAngels.includes(angel) || teamEditAngels.length >= 2) return;
    setTeamEditAngels((prev) => [...prev, angel]);
    setTeamEditAngelInput("");
  }

  function addTeamEditMembers(): void {
    const names = parseNames(teamEditMemberInput);
    if (names.length === 0) return;
    setTeamEditMembers((prev) => uniq([...prev, ...names]));
    setTeamEditMemberInput("");
  }

  function deleteEditingTeam(): void {
    if (saving) return;
    if (pendingTeamEditIndex === null) return;
    const nextTeams = teams.filter((_, index) => index !== pendingTeamEditIndex);
    setTeams(nextTeams);
    void persist(fixedAngels, nextTeams, specialRoles, "삭제 완료");
    setPendingTeamEditIndex(null);
    setTeamEditName("");
    setTeamEditAngels([]);
    setTeamEditMembers([]);
    setTeamEditAngelInput("");
    setTeamEditMemberInput("");
  }

  const hasOperationNames = parseNames(operationInput).length > 0;
  const canAddTeam = newTeamName.trim().length > 0 && parseNames(newTeamAngels).length > 0;

  return (
    <div className="mt-4 grid gap-5">
      {saving ? (
        <div
          className="fixed right-4 top-4 z-50 inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-bold shadow-lg"
          style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
          role="status"
          aria-live="polite"
        >
          <LoadingSpinner />
          저장 중
        </div>
      ) : null}
      <section className="app-section order-2 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>운영진</p>
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
          <span
            className="rounded-full border px-2 py-1 text-xs font-semibold"
            style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)", color: "var(--ink-soft)" }}
          >
            {fixedAngels.length + SPECIAL_PARTICIPANT_ROLES.reduce((sum, role) => sum + (specialRoles[role]?.length ?? 0), 0)}명
          </span>
        </div>

        <div className="list-surface mt-3 p-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {OPERATION_ROLE_ORDER.map((role) => {
              const meta = roleMeta(role);
              const members = operationMembers(role);
              return (
                <button
                  type="button"
                  key={`operation-role-card-${role}`}
                  className="btn-press flex h-full flex-col items-stretch justify-start overflow-hidden rounded-2xl border border-t-[3px] bg-white text-left transition hover:-translate-y-0.5 hover:shadow-md"
                  style={{ borderColor: "var(--line)", borderTopColor: meta.accentColor }}
                  onClick={() => {
                    setActiveOperationRole(role);
                    setOperationInput("");
                    setOperationEditDrafts({});
                    setOperationAddOpen(true);
                  }}
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
                    </div>
                  </div>

                  <div className="min-h-0 overflow-y-auto p-2">
                    {members.length > 0 ? (
                      <ul className="grid gap-1.5">
                        {members.map((member, memberIndex) => (
                          <li
                            key={`operation-member-${role}-${member}`}
                            className="flex min-h-10 items-center gap-2 rounded-xl border px-2 py-1.5"
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
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="app-section order-1 p-5 sm:p-6">
        <MemberSaveToolbar
          teamCount={teams.length}
          memberCount={totalTeamMemberCount}
          onAddTeam={() => {
            setNewTeamName(`${teams.length + 1}팀`);
            setTeamAddOpen(true);
          }}
        />

        <div className="mt-3">
          {teams.length === 0 ? (
            <p className="rounded-xl border border-dashed px-3 py-3 text-xs" style={{ borderColor: "var(--line)", color: "var(--ink-muted)" }}>
              팀이 없습니다. 상단의 추가 버튼으로 시작하세요.
            </p>
          ) : (
            <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1 stagger-children">
              {teams.map((team, index) => (
                <button
                  key={team.id}
                  type="button"
                  className="btn-press overflow-hidden rounded-2xl border bg-white p-0 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  style={{ borderColor: "var(--line)" }}
                  onClick={() => openTeamEdit(index)}
                >
                  <div className="px-4 py-3" style={{ backgroundColor: "#f8fbff" }}>
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
                  </div>

                  <div className="border-t px-4 py-3" style={{ borderColor: "var(--line)" }}>
                    {team.members.length > 0 ? (
                      <p className="line-clamp-2 text-sm leading-6" style={{ color: "var(--ink-soft)" }}>
                        {team.members.slice(0, 8).map((member) => member.name).join(", ")}
                        {team.members.length > 8 ? ` 외 ${team.members.length - 8}명` : ""}
                      </p>
                    ) : (
                      <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
                        등록된 멤버가 없습니다.
                      </p>
                      )}
                  </div>
                </button>
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
                  placeholder="예: 장영실, 이순신"
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
                disabled={!canAddTeam || saving}
                className="btn-press rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed"
                style={{ backgroundColor: "var(--accent)", opacity: canAddTeam && !saving ? 1 : 0.45 }}
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
              {roleMeta(activeOperationRole).label}
            </h4>
            <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
              명단을 추가하거나 수정합니다.
            </p>

            <div className="mt-4 grid gap-3">
              <section className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
                    명단
                  </p>
                  <span className="text-xs font-semibold" style={{ color: "var(--ink-muted)" }}>
                    {operationMembers(activeOperationRole).length}명
                  </span>
                </div>
                {operationMembers(activeOperationRole).length > 0 ? (
                  <ul className="grid max-h-52 gap-1.5 overflow-y-auto rounded-xl border p-2" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)" }}>
                    {operationMembers(activeOperationRole).map((member) => {
                      const isTeamAssignedAngel =
                        activeOperationRole === "angel" && teamAssignedAngelSet.has(member);
                      return (
                        <li
                          key={`operation-modal-member-${activeOperationRole}-${member}`}
                          className="grid gap-2 rounded-lg border bg-white p-2 sm:grid-cols-[minmax(0,1fr)_auto]"
                          style={{ borderColor: "var(--line)" }}
                        >
                          <input
                            value={operationEditDrafts[member] ?? member}
                            onChange={(event) => {
                              const value = event.target.value;
                              setOperationEditDrafts((prev) => ({ ...prev, [member]: value }));
                            }}
                            disabled={saving || isTeamAssignedAngel}
                            className="h-9 min-w-0 rounded-lg border bg-white px-2 text-sm font-semibold disabled:opacity-60"
                            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                          />
                          <div className="flex justify-end gap-1.5">
                            {isTeamAssignedAngel ? (
                              <span className="inline-flex h-8 items-center rounded-lg border px-2 text-[11px] font-semibold" style={{ borderColor: "var(--line)", color: "var(--ink-muted)", backgroundColor: "var(--surface-alt)" }}>
                                팀 담당
                              </span>
                            ) : null}
                            <button
                              type="button"
                              disabled={saving || isTeamAssignedAngel}
                              className="btn-press shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                              style={{ borderColor: "rgba(13, 127, 242, 0.25)", color: "var(--accent-strong)", backgroundColor: "var(--accent-weak)" }}
                              onClick={() => updateOperationMember(activeOperationRole, member)}
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              disabled={saving || isTeamAssignedAngel}
                              className="btn-press shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                              style={{ borderColor: "#fecaca", color: "var(--danger)", backgroundColor: "var(--danger-bg)" }}
                              onClick={() => removeOperationMember(activeOperationRole, member)}
                            >
                              삭제
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-dashed px-3 py-4 text-center text-xs" style={{ borderColor: "var(--line)", color: "var(--ink-muted)" }}>
                    등록된 인원이 없습니다.
                  </p>
                )}
              </section>

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
                  setOperationEditDrafts({});
                  setOperationAddOpen(false);
                }}
              >
                취소
              </button>
              <button
                type="button"
                disabled={!hasOperationNames || saving}
                className="btn-press rounded-xl px-3 py-2 text-xs font-semibold"
                style={{
                  backgroundColor: roleMeta(activeOperationRole).backgroundColor,
                  color: roleMeta(activeOperationRole).textColor,
                  opacity: hasOperationNames && !saving ? 1 : 0.45,
                }}
                onClick={() => {
                  if (!hasOperationNames) return;
                  addOperationMembers(activeOperationRole, operationInput);
                  setOperationInput("");
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
        teamMembers={teamEditMembers}
        teamAngelInput={teamEditAngelInput}
        teamMemberInput={teamEditMemberInput}
        onTeamNameChange={setTeamEditName}
        onTeamAngelsChange={setTeamEditAngels}
        onTeamMembersChange={setTeamEditMembers}
        onTeamAngelInputChange={setTeamEditAngelInput}
        onTeamMemberInputChange={setTeamEditMemberInput}
        onAddAngel={addTeamEditAngel}
        onAddMembers={addTeamEditMembers}
        onCancel={() => {
          setPendingTeamEditIndex(null);
          setTeamEditName("");
          setTeamEditAngels([]);
          setTeamEditMembers([]);
          setTeamEditAngelInput("");
          setTeamEditMemberInput("");
        }}
        onDelete={deleteEditingTeam}
        onSubmit={submitTeamEdit}
      />
      {toast ? <ToastNotice key={toast.id} message={toast.message} tone={toast.tone} /> : null}
    </div>
  );
}
