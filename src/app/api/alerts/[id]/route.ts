import { NextRequest, NextResponse } from "next/server";

import { deleteAlert, updateAlert } from "@/lib/store";
import { alertInputSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const parsed = alertInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const data = parsed.data;
  const updated = await updateAlert(id, (current) => ({
    ...current,
    ...data,
    maxDurationMinutes: data.maxDurationMinutes === undefined ? current.maxDurationMinutes : data.maxDurationMinutes,
    minDelayMinutes: data.minDelayMinutes === undefined ? current.minDelayMinutes : data.minDelayMinutes,
    incidentKeywordFilter:
      data.incidentKeywordFilter === undefined ? current.incidentKeywordFilter : data.incidentKeywordFilter,
    smsPhoneNumber: data.smsPhoneNumber === undefined ? current.smsPhoneNumber : data.smsPhoneNumber
  }));
  if (!updated) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  return NextResponse.json({ alert: updated });
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params;
  await deleteAlert(id);
  return NextResponse.json({ ok: true });
}
