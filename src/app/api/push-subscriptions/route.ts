import { NextRequest, NextResponse } from "next/server";

import { upsertPushSubscription } from "@/lib/store";
import { pushSubSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = pushSubSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
  }

  await upsertPushSubscription({
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth
  });

  return NextResponse.json({ ok: true });
}
