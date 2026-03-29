import { getTrafficIncidents } from "@/lib/services/incidents";
import { getCommuteSnapshot } from "@/lib/services/googleMaps";
import { sendPushNotification, sendSmsIfEnabled } from "@/lib/services/notifier";
import { getSevereWeatherForAddress } from "@/lib/services/weather";
import { addCheck, Alert, listAlerts, updateAlert } from "@/lib/store";
import { isNowInWindow, weekdayNumber } from "@/lib/time";

type CheckResult = {
  alertId: string;
  checked: boolean;
  triggered: boolean;
  reasons: string[];
};

function isAlertActiveByTime(alert: Alert, now: Date): boolean {
  const days = alert.daysOfWeekCsv
    .split(",")
    .map((v) => Number.parseInt(v.trim(), 10))
    .filter((v) => Number.isInteger(v) && v >= 1 && v <= 7);

  if (!days.includes(weekdayNumber(now))) {
    return false;
  }

  return isNowInWindow(alert.startTime, alert.endTime, now);
}

function minutesSince(date: Date, now: Date): number {
  return (now.getTime() - date.getTime()) / 60000;
}

export async function runChecksForAllAlerts(now = new Date()): Promise<CheckResult[]> {
  const alerts = (await listAlerts()).filter((a) => a.enabled);
  const results: CheckResult[] = [];

  for (const alert of alerts) {
    results.push(await runCheckForSingleAlert(alert, now));
  }

  return results;
}

export async function runCheckForSingleAlert(alert: Alert, now = new Date()): Promise<CheckResult> {
  if (!isAlertActiveByTime(alert, now)) {
    return {
      alertId: alert.id,
      checked: false,
      triggered: false,
      reasons: ["Outside alert time window"]
    };
  }

  const commute = await getCommuteSnapshot(alert.originAddress, alert.destinationAddress);
  const weather = await getSevereWeatherForAddress(alert.originAddress);
  const incidents = await getTrafficIncidents(alert.originAddress, alert.destinationAddress);
  const reasons: string[] = [];

  if (alert.maxDurationMinutes !== null && commute.trafficMinutes >= alert.maxDurationMinutes) {
    reasons.push(`Commute is ${commute.trafficMinutes}m (threshold ${alert.maxDurationMinutes}m)`);
  }

  if (alert.minDelayMinutes !== null && commute.delayMinutes >= alert.minDelayMinutes) {
    reasons.push(`Delay is ${commute.delayMinutes}m (threshold ${alert.minDelayMinutes}m)`);
  }

  if (alert.severeWeatherRequired) {
    if (weather.length > 0) {
      reasons.push(`Severe weather: ${weather[0].event}`);
    } else {
      reasons.length = 0;
    }
  } else if (weather.length > 0) {
    reasons.push(`Weather advisory: ${weather[0].event}`);
  }

  if (alert.incidentKeywordFilter && alert.incidentKeywordFilter.trim().length > 0) {
    const needle = alert.incidentKeywordFilter.toLowerCase();
    const matched = incidents.some((i) =>
      `${i.title} ${i.description} ${i.location}`.toLowerCase().includes(needle)
    );
    if (matched) {
      reasons.push(`Incident matched keyword "${alert.incidentKeywordFilter}"`);
    } else {
      reasons.length = 0;
    }
  } else if (incidents.length > 0) {
    reasons.push(`Traffic incident: ${incidents[0].title}`);
  }

  const triggered = reasons.length > 0;
  const nextCount = triggered ? alert.consecutiveTriggerCount + 1 : 0;

  await addCheck({
    alertId: alert.id,
    triggered,
    triggerReasons: triggered ? reasons.join(" | ") : "No threshold met",
    travelDurationMinutes: commute.trafficMinutes,
    baselineDurationMinutes: commute.baselineMinutes,
    delayMinutes: commute.delayMinutes,
    weatherSummary: weather.map((w) => `${w.event} (${w.severity})`).join("; ") || "No severe weather",
    incidentSummary: incidents.map((i) => i.title).join("; ") || "No incidents"
  });

  await updateAlert(alert.id, (current) => ({
    ...current,
    consecutiveTriggerCount: nextCount,
    lastTriggeredAt: triggered ? now.toISOString() : current.lastTriggeredAt
  }));

  const cooldownPassed =
    !alert.lastNotifiedAt || minutesSince(new Date(alert.lastNotifiedAt), now) >= alert.cooldownMinutes;
  const enoughConsecutiveHits = nextCount >= alert.minConsecutiveTriggers;
  const shouldNotify = triggered && cooldownPassed && enoughConsecutiveHits;

  if (shouldNotify) {
    const message = [
      `${alert.name}: commute alert triggered.`,
      `Current: ${commute.trafficMinutes}m`,
      `Delay: ${commute.delayMinutes}m`,
      `Reason: ${reasons.join("; ")}`
    ].join(" ");

    if (alert.smsEnabled) {
      await sendSmsIfEnabled(alert.smsPhoneNumber, message);
    }
    if (alert.pushEnabled) {
      await sendPushNotification(message);
    }

    await updateAlert(alert.id, (current) => ({
      ...current,
      lastNotifiedAt: now.toISOString()
    }));
  }

  return {
    alertId: alert.id,
    checked: true,
    triggered,
    reasons
  };
}
