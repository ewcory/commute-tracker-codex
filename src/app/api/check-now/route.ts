import { NextResponse } from "next/server";

import { runChecksForAllAlerts } from "@/lib/alertEngine";

export const runtime = "nodejs";

export async function POST() {
  try {
    const results = await runChecksForAllAlerts(new Date());
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
