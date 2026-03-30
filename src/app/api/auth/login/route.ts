import { NextRequest, NextResponse } from "next/server";

import { createSessionForUser, loginUser, setAuthCookie } from "@/lib/auth";
import { authSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = authSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid username/password format." }, { status: 400 });
  }

  const user = await loginUser(parsed.data.username, parsed.data.password);
  if (!user) {
    return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
  }

  const sessionId = await createSessionForUser(user.id);
  const res = NextResponse.json({ ok: true, user: { id: user.id, username: user.username } });
  setAuthCookie(res, sessionId);
  return res;
}
