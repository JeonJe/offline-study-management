import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const [row] = await query<{ now: string }>(
      "SELECT NOW() AS now"
    );
    return NextResponse.json({
      ok: true,
      now: row?.now,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error while checking database";
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: string }).code
        : undefined;

    return NextResponse.json(
      { ok: false, error: message, code },
      { status: 500 }
    );
  }
}
