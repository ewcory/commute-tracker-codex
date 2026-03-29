import { NextRequest, NextResponse } from "next/server";

import { runChecksForAllAlerts } from "@/lib/alertEngine";

export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const authHeader = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const cronHeader = req.headers.get("x-cron-secret");
  return authHeader === secret || cronHeader === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runChecksForAllAlerts(new Date());
  return NextResponse.json({ ok: true, results });
}
