"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  SpecialParticipantRole,
  SpecialRoleDirectory,
  TeamMemberGroup,
} from "@/lib/member-store";
import { AddTeamHeaderButton } from "@/app/members/add-team-header-button";
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
  members: string[];
  memberInput: string;
};

type OperationRole = "angel" | SpecialParticipantRole;

function generateTeamId(): string {
  return `team-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
      members: uniq(team.members),
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
  const initialRenderRef = useRef(true);
  const savingRef = useRef(false);
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
        members: uniq(team.members),
      })),
      specialRoles: Object.fromEntries(
        SPECIAL_PARTICIPANT_ROLES.map((role) => [role, uniq(specialRoles[role] ?? [])])
      ) as SpecialRoleDirectory,
    }),
    [fixedAngels, teams, specialRoles]
  );

  const canAutoSave = useMemo(() => {
    if (payload.fixedAngels.length === 0) return false;
    if (payload.teamGroups.length === 0) return false;
    return payload.teamGroups.every((team) => team.teamName.length > 0 && team.angels.length > 0);
  }, [payload]);

  const saveNow = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveState("idle");

    try {
      const response = await fetch("/api/members/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSaveState(response.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [payload]);

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

  const addTeam = useCallback((): void => {
    setTeams((prev) => [
      ...prev,
      {
        id: generateTeamId(),
        teamName: `${prev.length + 1}팀`,
        angels: [],
        angelInput: "",
        members: [],
        memberInput: "",
      },
    ]);
  }, []);

  useEffect(() => {
    const handler = () => addTeam();
    window.addEventListener("members:add-team", handler);
    return () => window.removeEventListener("members:add-team", handler);
  }, [addTeam]);

  function addMembers(index: number, raw: string): void {
    const names = parseNames(raw);
    if (names.length === 0) return;

    updateTeam(index, (team) => ({
      ...team,
      members: uniq([...team.members, ...names]),
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
          <span
            className="rounded-full border px-2 py-1 text-xs font-semibold"
            style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)", color: "var(--ink-soft)" }}
          >
            {fixedAngels.length + SPECIAL_PARTICIPANT_ROLES.reduce((sum, role) => sum + (specialRoles[role]?.length ?? 0), 0)}명
          </span>
        </div>

        <div className="mt-3 rounded-xl border p-3" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}>
          <div className="flex flex-wrap gap-1.5">
            {OPERATION_ROLE_ORDER.map((role) => {
              const meta = roleMeta(role);
              const active = activeOperationRole === role;
              return (
                <button
                  key={`operation-role-tab-${role}`}
                  type="button"
                  onClick={() => setActiveOperationRole(role)}
                  className="btn-press rounded-full border px-2 py-1 text-xs font-semibold"
                  style={
                    active
                      ? { borderColor: meta.borderColor, backgroundColor: meta.backgroundColor, color: meta.textColor }
                      : { borderColor: "var(--line)", backgroundColor: "var(--surface)", color: "var(--ink-soft)" }
                  }
                >
                  {meta.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold" style={{ color: roleMeta(activeOperationRole).textColor }}>
              {roleMeta(activeOperationRole).label}
            </p>
            <span className="text-[11px]" style={{ color: "var(--ink-muted)" }}>
              {operationMembers(activeOperationRole).length}명
            </span>
          </div>

          <div className="mt-2 flex max-h-36 min-h-10 flex-wrap gap-1.5 overflow-y-auto pr-1">
            {operationMembers(activeOperationRole).map((member) => (
              <span
                key={`operation-member-${activeOperationRole}-${member}`}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium"
                style={{
                  borderColor: roleMeta(activeOperationRole).borderColor,
                  backgroundColor: roleMeta(activeOperationRole).backgroundColor,
                  color: roleMeta(activeOperationRole).textColor,
                }}
              >
                {roleMeta(activeOperationRole).emoji ? `${roleMeta(activeOperationRole).emoji} ` : ""}
                {member}
                <RemoveChipButton
                  label={`${member} ${roleMeta(activeOperationRole).label} 삭제`}
                  onClick={() => removeOperationMember(activeOperationRole, member)}
                />
              </span>
            ))}
            {operationMembers(activeOperationRole).length === 0 ? (
              <span className="text-xs" style={{ color: "var(--ink-muted)" }}>등록된 인원 없음</span>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={operationInput}
              onChange={(event) => setOperationInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                addOperationMembers(activeOperationRole, operationInput);
                setOperationInput("");
              }}
              className="h-8 w-full rounded-xl border bg-white px-2 text-xs sm:w-52"
              style={{ borderColor: "var(--line)" }}
              placeholder={`${roleMeta(activeOperationRole).label} 이름 (쉼표/Enter로 여러 명)`}
            />
            <button
              type="button"
              className="btn-press h-8 rounded-xl border px-2 text-xs font-semibold"
              style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
              onClick={() => {
                addOperationMembers(activeOperationRole, operationInput);
                setOperationInput("");
              }}
            >
              추가
            </button>
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
          <AddTeamHeaderButton />
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
                <article key={team.id} className="card-static p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={team.teamName}
                        onChange={(event) => updateTeam(index, (prev) => ({ ...prev, teamName: event.target.value }))}
                        className="h-9 w-24 rounded-xl border bg-white px-2 text-xs"
                        style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
                        placeholder="팀명"
                      />
                      <span
                        className="rounded-full border px-2 py-1 text-[11px] font-semibold"
                        style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)", color: "var(--ink-soft)" }}
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

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>멤버</span>
                      <span className="text-xs" style={{ color: "var(--ink-muted)" }}>{team.members.length}명</span>
                    </div>

                    <div
                      className="mt-2 flex min-h-12 flex-wrap gap-2 rounded-xl border bg-white px-2 py-2"
                      style={{ borderColor: "var(--line)" }}
                    >
                      {team.members.map((member) => (
                        <span
                          key={`${team.teamName}-${member}`}
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs"
                          style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)", color: "var(--ink-soft)" }}
                        >
                          {member}
                          <RemoveChipButton
                            label={`${member} 멤버 삭제`}
                            onClick={() =>
                              updateTeam(index, (prev) => ({
                                ...prev,
                                members: prev.members.filter((name) => name !== member),
                              }))
                            }
                          />
                        </span>
                      ))}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        value={team.memberInput}
                        onChange={(event) => updateTeam(index, (prev) => ({ ...prev, memberInput: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          addMembers(index, team.memberInput);
                        }}
                        className="h-9 w-full rounded-xl border bg-white px-2 text-xs sm:w-52"
                        style={{ borderColor: "var(--line)" }}
                        placeholder="멤버 이름 (쉼표/Enter로 여러 명)"
                      />
                      <button
                        type="button"
                        className="btn-press h-9 rounded-xl border px-2 text-xs font-semibold"
                        style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
                        onClick={() => addMembers(index, team.memberInput)}
                      >
                        추가
                      </button>
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

      {pendingAngelManageIndex !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-white p-5 shadow-2xl" style={{ borderColor: "var(--line)" }}>
            <h4 className="text-base font-semibold" style={{ color: "var(--ink)" }}>
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

      {pendingDeleteIndex !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-2xl border bg-white p-5 shadow-2xl" style={{ borderColor: "var(--line)" }}>
            <h4 className="text-base font-semibold" style={{ color: "var(--ink)" }}>팀 삭제 확인</h4>
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
