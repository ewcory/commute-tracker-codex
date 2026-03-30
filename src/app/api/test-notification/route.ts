import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth";
import { sendPushNotification } from "@/lib/services/notifier";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getAuthUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await sendPushNotification(
      `Test message from Commute Tracker at ${new Date().toLocaleString("en-US", {
        timeZone: "America/Los_Angeles"
      })}.`
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
