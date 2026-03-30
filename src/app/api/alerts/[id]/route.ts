import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth";
import { geocodeAddress } from "@/lib/services/googleMaps";
import { deleteAlertForUser, updateAlertForUser } from "@/lib/store";
import { alertInputSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getAuthUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = alertInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const data = parsed.data;
  try {
    if (data.originAddress) {
      await geocodeAddress(data.originAddress);
    }
    if (data.destinationAddress) {
      await geocodeAddress(data.destinationAddress);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Address validation failed";
    return NextResponse.json(
      {
        error: `Could not verify one or both addresses. Please choose full addresses from autocomplete. ${message}`
      },
      { status: 400 }
    );
  }

  const updated = await updateAlertForUser(id, user.id, (current) => ({
    ...current,
    ...data,
    maxDurationMinutes: data.maxDurationMinutes === undefined ? current.maxDurationMinutes : data.maxDurationMinutes,
    minDelayMinutes: data.minDelayMinutes === undefined ? current.minDelayMinutes : data.minDelayMinutes,
    rapidIncreaseEnabled:
      data.rapidIncreaseEnabled === undefined ? current.rapidIncreaseEnabled : data.rapidIncreaseEnabled,
    rapidIncreaseMinRiseMinutes:
      data.rapidIncreaseMinRiseMinutes === undefined
        ? current.rapidIncreaseMinRiseMinutes
        : data.rapidIncreaseMinRiseMinutes,
    rapidIncreaseLookaheadMinutes:
      data.rapidIncreaseLookaheadMinutes === undefined
        ? current.rapidIncreaseLookaheadMinutes
        : data.rapidIncreaseLookaheadMinutes,
    incidentKeywordFilter:
      data.incidentKeywordFilter === undefined ? current.incidentKeywordFilter : data.incidentKeywordFilter
  }));
  if (!updated) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  return NextResponse.json({ alert: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getAuthUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await deleteAlertForUser(id, user.id);
  return NextResponse.json({ ok: true });
}
