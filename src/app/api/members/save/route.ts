import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { saveMemberPresetToDb, type TeamMemberGroup } from "@/lib/member-store";

type BodyShape = {
  fixedAngels?: unknown;
  teamGroups?: unknown;
};

function parseBody(input: BodyShape): { fixedAngels: string[]; teamGroups: TeamMemberGroup[] } | null {
  const fixedAngels = Array.isArray(input.fixedAngels)
    ? input.fixedAngels
        .filter((item): item is string => typeof item === "string")
        .map((v) => v.trim())
        .filter(Boolean)
    : [];

  const teamGroups = Array.isArray(input.teamGroups)
    ? input.teamGroups
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const obj = row as { teamName?: unknown; angel?: unknown; members?: unknown };
          const teamName = typeof obj.teamName === "string" ? obj.teamName.trim() : "";
          const angel = typeof obj.angel === "string" ? obj.angel.trim() : "";
          const members = Array.isArray(obj.members)
            ? obj.members
                .filter((item): item is string => typeof item === "string")
                .map((v) => v.trim())
                .filter(Boolean)
            : [];
          if (!teamName || !angel) return null;
          return { teamName, angel, members };
        })
        .filter((row): row is TeamMemberGroup => row !== null)
    : [];

  if (fixedAngels.length === 0 || teamGroups.length === 0) {
    return null;
  }

  return { fixedAngels, teamGroups };
}

export async function POST(request: Request) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: BodyShape;
  try {
    body = (await request.json()) as BodyShape;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const parsed = parseBody(body);
  if (!parsed) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  try {
    await saveMemberPresetToDb(parsed.teamGroups, parsed.fixedAngels);
  } catch {
    return NextResponse.json({ ok: false, error: "save failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
