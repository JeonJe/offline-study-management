import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const [row] = await query<{ now: string; version: string }>(
      "SELECT NOW() AS now, VERSION() AS version"
    );
    return NextResponse.json({
      ok: true,
      now: row?.now,
      version: row?.version,
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
