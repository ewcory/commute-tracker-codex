import { NextRequest, NextResponse } from "next/server";

import { createAlert, latestCheckByAlertId, listAlerts } from "@/lib/store";
import { alertInputSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  const baseAlerts = await listAlerts();
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
  const created = await createAlert({
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
      smsEnabled: data.smsEnabled ?? false,
      pushEnabled: data.pushEnabled ?? true,
      smsPhoneNumber: data.smsPhoneNumber ?? null,
      lastNotifiedAt: null,
      lastTriggeredAt: null,
      consecutiveTriggerCount: 0
  });

  return NextResponse.json({ alert: created }, { status: 201 });
}
