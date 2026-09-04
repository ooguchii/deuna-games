import { NextResponse, type NextRequest } from "next/server";

import {
  getGameMediaWorkspaceSnapshot,
} from "@/lib/admin/game-media-workspace";
import {
  verifyAdminSession,
} from "@/lib/admin/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  await verifyAdminSession();
  const { slug } = await context.params;
  const snapshot = await getGameMediaWorkspaceSnapshot(slug);

  if (!snapshot) {
    return NextResponse.json(
      { error: "Juego no encontrado." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "no-store" },
  });
}
