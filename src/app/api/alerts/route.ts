import { NextRequest, NextResponse } from "next/server";

import { getAuthUserFromRequest } from "@/lib/auth";
import { geocodeAddress } from "@/lib/services/googleMaps";
import { createAlert, latestCheckByAlertId, listAlertsForUser } from "@/lib/store";
import { alertInputSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getAuthUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseAlerts = await listAlertsForUser(user.id);
  const alerts = await Promise.all(
    baseAlerts.map(async (alert) => {
      const latest = await latestCheckByAlertId(alert.id);
      return {
        ...alert,
        checks: latest ? [latest] : []
      };
    })
  );

  return NextResponse.json({ alerts });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = alertInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid alert payload",
        issues: parsed.error.issues
      },
      { status: 400 }
    );
  }

  const data = parsed.data;
  try {
    await geocodeAddress(data.originAddress);
    await geocodeAddress(data.destinationAddress);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Address validation failed";
    return NextResponse.json(
      {
        error: `Could not verify one or both addresses. Please choose full addresses from autocomplete. ${message}`
      },
      { status: 400 }
    );
  }

  const created = await createAlert({
      userId: user.id,
      name: data.name,
      originAddress: data.originAddress,
      destinationAddress: data.destinationAddress,
      enabled: data.enabled ?? true,
      maxDurationMinutes: data.maxDurationMinutes ?? null,
      minDelayMinutes: data.minDelayMinutes ?? null,
      severeWeatherRequired: data.severeWeatherRequired ?? false,
      incidentKeywordFilter: data.incidentKeywordFilter ?? null,
      daysOfWeekCsv: data.daysOfWeekCsv ?? "1,2,3,4,5",
      startTime: data.startTime ?? "06:00",
      endTime: data.endTime ?? "10:00",
      cooldownMinutes: data.cooldownMinutes ?? 45,
      minConsecutiveTriggers: data.minConsecutiveTriggers ?? 1,
      rapidIncreaseEnabled: data.rapidIncreaseEnabled ?? true,
      rapidIncreaseMinRiseMinutes: data.rapidIncreaseMinRiseMinutes ?? 5,
      rapidIncreaseLookaheadMinutes: data.rapidIncreaseLookaheadMinutes ?? 20,
      pushEnabled: data.pushEnabled ?? true,
      lastNotifiedAt: null,
      lastTriggeredAt: null,
      consecutiveTriggerCount: 0
  });

  return NextResponse.json({ alert: created }, { status: 201 });
}
