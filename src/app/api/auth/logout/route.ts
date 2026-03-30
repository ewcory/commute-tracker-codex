import { NextRequest, NextResponse } from "next/server";

import { clearAuthCookie, clearSessionFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  await clearSessionFromRequest(req);
  const res = NextResponse.json({ ok: true });
  clearAuthCookie(res);
  return res;
}
