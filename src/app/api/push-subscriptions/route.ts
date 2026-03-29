import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(_: NextRequest) {
  return NextResponse.json({
    ok: true,
    message: "Browser push subscriptions are not used in ntfy mode."
  });
}
