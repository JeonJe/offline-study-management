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
  angel: string;
  members: string[];
  memberInput: string;
};

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

const SPECIAL_ROLE_DISPLAY_ORDER: SpecialParticipantRole[] = [
  "mentor",
  "manager",
  "supporter",
  "buddy",
];
const SPECIAL_PARTICIPANT_ROLES: SpecialParticipantRole[] = [
  "supporter",
  "buddy",
  "mentor",
  "manager",
];

function createEmptySpecialRoleInputs(): Record<SpecialParticipantRole, string> {
  return {
    supporter: "",
    buddy: "",
    mentor: "",
    manager: "",
  };
}

export function MemberAdminForm({
  initialFixedAngels,
  initialTeamGroups,
  initialSpecialRoles,
}: MemberAdminFormProps) {
  const [fixedAngels, setFixedAngels] = useState<string[]>(uniq(initialFixedAngels));
  const [angelInput, setAngelInput] = useState("");
  const [teams, setTeams] = useState<TeamDraft[]>(
    initialTeamGroups.map((team) => ({
      id: generateTeamId(),
      teamName: team.teamName,
      angel: team.angel,
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
  const [specialRoleInputs, setSpecialRoleInputs] = useState<Record<SpecialParticipantRole, string>>(
    createEmptySpecialRoleInputs()
  );

  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);
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
        angel: team.angel.trim(),
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
    return payload.teamGroups.every((team) => team.teamName.length > 0 && team.angel.length > 0);
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
        angel: "",
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

  function addAngels(raw: string): void {
    const names = parseNames(raw);
    if (names.length === 0) return;

    setFixedAngels((prev) => uniq([...prev, ...names]));
    setAngelInput("");
  }

  function addSpecialRoleMembers(role: SpecialParticipantRole, raw: string): void {
    const names = parseNames(raw);
    if (names.length === 0) return;

    setSpecialRoles((prev) => ({
      ...prev,
      [role]: uniq([...(prev[role] ?? []), ...names]),
    }));
    setSpecialRoleInputs((prev) => ({ ...prev, [role]: "" }));
  }

  return (
    <div className="mt-4 grid gap-4">
      <section className="card-static p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>루퍼스 운영진</p>
            <p className="text-xs" style={{ color: "var(--ink-muted)" }}>엔젤 및 역할 디렉터리</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <span
                className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                style={{ borderColor: "#fbbf24", backgroundColor: "var(--angel-bg)", color: "#92400e" }}
              >
                엔젤 {fixedAngels.length}명
              </span>
              {SPECIAL_ROLE_DISPLAY_ORDER.map((role) => {
                const roleMeta = PARTICIPANT_ROLE_META[role];
                return (
                  <span
                    key={`operations-role-summary-${role}`}
                    className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                    style={{ borderColor: roleMeta.borderColor, backgroundColor: roleMeta.backgroundColor, color: roleMeta.textColor }}
                  >
                    {roleMeta.label} {(specialRoles[role] ?? []).length}명
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

        <div className="mt-3 grid gap-3">
          <section className="rounded-lg border p-2" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold" style={{ color: "#92400e" }}>엔젤</p>
              <span className="text-[11px]" style={{ color: "var(--ink-muted)" }}>{fixedAngels.length}명</span>
            </div>

            <div className="mt-2 flex min-h-10 flex-wrap gap-1.5">
              {fixedAngels.map((angel) => (
                <span
                  key={angel}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium"
                  style={{ borderColor: "#fbbf24", backgroundColor: "var(--angel-bg)", color: "#92400e" }}
                >
                  🪽 {angel}
                  <button type="button" onClick={() => setFixedAngels((prev) => prev.filter((name) => name !== angel))}>
                    ×
                  </button>
                </span>
              ))}
              {fixedAngels.length === 0 ? (
                <span className="text-xs" style={{ color: "var(--ink-muted)" }}>등록된 인원 없음</span>
              ) : null}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={angelInput}
                onChange={(event) => setAngelInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  addAngels(angelInput);
                }}
                className="h-8 w-full rounded-lg border bg-white px-2 text-xs sm:w-44"
                style={{ borderColor: "var(--line)" }}
                placeholder="엔젤 이름"
              />
              <button
                type="button"
                className="btn-press h-8 rounded-lg border px-2 text-xs font-semibold"
                style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
                onClick={() => addAngels(angelInput)}
              >
                추가
              </button>
            </div>
          </section>

          {SPECIAL_ROLE_DISPLAY_ORDER.map((role) => {
            const roleMeta = PARTICIPANT_ROLE_META[role];
            const members = specialRoles[role] ?? [];
            return (
              <section key={`special-role-${role}`} className="rounded-lg border p-2" style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)" }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold" style={{ color: roleMeta.textColor }}>{roleMeta.label}</p>
                  <span className="text-[11px]" style={{ color: "var(--ink-muted)" }}>{members.length}명</span>
                </div>

                <div className="mt-2 flex min-h-10 flex-wrap gap-1.5">
                  {members.map((member) => (
                    <span
                      key={`special-role-member-${role}-${member}`}
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium"
                      style={{ borderColor: roleMeta.borderColor, backgroundColor: roleMeta.backgroundColor, color: roleMeta.textColor }}
                    >
                      {roleMeta.emoji ? `${roleMeta.emoji} ` : ""}{member}
                      <button
                        type="button"
                        onClick={() =>
                          setSpecialRoles((prev) => ({
                            ...prev,
                            [role]: prev[role].filter((name) => name !== member),
                          }))
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {members.length === 0 ? (
                    <span className="text-xs" style={{ color: "var(--ink-muted)" }}>등록된 인원 없음</span>
                  ) : null}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    value={specialRoleInputs[role]}
                    onChange={(event) =>
                      setSpecialRoleInputs((prev) => ({
                        ...prev,
                        [role]: event.target.value,
                      }))
                    }
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      addSpecialRoleMembers(role, specialRoleInputs[role]);
                    }}
                    className="h-8 w-full rounded-lg border bg-white px-2 text-xs sm:w-44"
                    style={{ borderColor: "var(--line)" }}
                    placeholder={`${roleMeta.label} 이름`}
                  />
                  <button
                    type="button"
                    className="btn-press h-8 rounded-lg border px-2 text-xs font-semibold"
                    style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
                    onClick={() => addSpecialRoleMembers(role, specialRoleInputs[role])}
                  >
                    추가
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <section className="card-static p-4 sm:p-5">
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
            <div className="grid gap-3 stagger-children">
              {teams.map((team, index) => (
                <article key={team.id} className="card-static p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-full border px-2 py-1 text-[11px] font-semibold"
                        style={{ borderColor: "var(--line)", backgroundColor: "var(--surface)", color: "var(--ink-soft)" }}
                      >
                        팀 {index + 1}
                      </span>
                      <input
                        value={team.teamName}
                        onChange={(event) => updateTeam(index, (prev) => ({ ...prev, teamName: event.target.value }))}
                        className="h-9 w-24 rounded-lg border bg-white px-2 text-xs"
                        style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
                        placeholder="팀명"
                      />
                      <input
                        value={team.angel}
                        list="member-fixed-angels"
                        onChange={(event) => updateTeam(index, (prev) => ({ ...prev, angel: event.target.value }))}
                        className="h-9 w-28 rounded-lg border px-2 text-xs"
                        style={{ borderColor: "#fbbf24", backgroundColor: "rgba(254, 243, 199, 0.3)", color: "#92400e" }}
                        placeholder="팀 엔젤"
                      />
                    </div>

                    <button
                      type="button"
                      className="btn-press h-9 rounded-lg border bg-white px-2 text-[11px] font-semibold"
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
                      className="mt-2 flex min-h-12 flex-wrap gap-2 rounded-lg border bg-white px-2 py-2"
                      style={{ borderColor: "var(--line)" }}
                    >
                      {team.members.map((member) => (
                        <span
                          key={`${team.teamName}-${member}`}
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs"
                          style={{ borderColor: "var(--line)", backgroundColor: "var(--surface-alt)", color: "var(--ink-soft)" }}
                        >
                          {member}
                          <button
                            type="button"
                            onClick={() =>
                              updateTeam(index, (prev) => ({
                                ...prev,
                                members: prev.members.filter((name) => name !== member),
                              }))
                            }
                          >
                            ×
                          </button>
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
                        className="h-9 w-full rounded-lg border bg-white px-2 text-xs sm:w-52"
                        style={{ borderColor: "var(--line)" }}
                        placeholder="멤버 이름"
                      />
                      <button
                        type="button"
                        className="btn-press h-9 rounded-lg border px-2 text-xs font-semibold"
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
                className="btn-press rounded-lg border bg-white px-3 py-2 text-xs font-semibold"
                style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
                onClick={() => setPendingDeleteIndex(null)}
              >
                취소
              </button>
              <button
                type="button"
                className="btn-press rounded-lg px-3 py-2 text-xs font-semibold text-white"
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
