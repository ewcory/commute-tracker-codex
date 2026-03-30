import { getTrafficIncidents } from "@/lib/services/incidents";
import { getCommuteSnapshot } from "@/lib/services/googleMaps";
import { sendPushNotification } from "@/lib/services/notifier";
import { getSevereWeatherForAddress } from "@/lib/services/weather";
import { addCheck, Alert, listAlerts, listRecentChecksByAlertId, updateAlertForUser } from "@/lib/store";
import { isNowInWindow, weekdayNumber } from "@/lib/time";

type CheckResult = {
  alertId: string;
  checked: boolean;
  triggered: boolean;
  reasons: string[];
};

const ALERT_TIMEZONE = process.env.ALERT_TIMEZONE || "America/Los_Angeles";

function isAlertActiveByTime(alert: Alert, now: Date): boolean {
  const days = alert.daysOfWeekCsv
    .split(",")
    .map((v) => Number.parseInt(v.trim(), 10))
    .filter((v) => Number.isInteger(v) && v >= 1 && v <= 7);

  if (!days.includes(weekdayNumber(now, ALERT_TIMEZONE))) {
    return false;
  }

  return isNowInWindow(alert.startTime, alert.endTime, now, ALERT_TIMEZONE);
}

function minutesSince(date: Date, now: Date): number {
  return (now.getTime() - date.getTime()) / 60000;
}

export async function runChecksForAllAlerts(now = new Date()): Promise<CheckResult[]> {
  const alerts = (await listAlerts()).filter((a) => a.enabled && Boolean(a.userId));
  const results: CheckResult[] = [];

  for (const alert of alerts) {
    results.push(await runCheckForSingleAlert(alert, now));
  }

  return results;
}

export async function runCheckForSingleAlert(alert: Alert, now = new Date()): Promise<CheckResult> {
  if (!isAlertActiveByTime(alert, now)) {
    await addCheck({
      alertId: alert.id,
      triggered: false,
      triggerReasons: "Skipped: outside alert time window/day settings",
      travelDurationMinutes: 0,
      baselineDurationMinutes: 0,
      delayMinutes: 0,
      weatherSummary: "Skipped",
      incidentSummary: "Skipped"
    });
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

  if (alert.rapidIncreaseEnabled && alert.maxDurationMinutes !== null) {
    const recent = await listRecentChecksByAlertId(alert.id, 1);
    const previous = recent[0];
    if (previous) {
      const prevMinutes = previous.travelDurationMinutes;
      const prevCheckedAt = new Date(previous.checkedAt);
      const minutesBetweenChecks = Math.max(1, (now.getTime() - prevCheckedAt.getTime()) / 60000);
      const rise = commute.trafficMinutes - prevMinutes;
      const risePerMinute = rise / minutesBetweenChecks;
      const projected = Math.round(commute.trafficMinutes + risePerMinute * alert.rapidIncreaseLookaheadMinutes);

      if (rise >= alert.rapidIncreaseMinRiseMinutes && projected >= alert.maxDurationMinutes) {
        reasons.push(
          `Rapid rise: +${rise}m since last check, projected ${projected}m in ${alert.rapidIncreaseLookaheadMinutes}m`
        );
      }
    }
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

  await updateAlertForUser(alert.id, alert.userId ?? "", (current) => ({
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

    if (alert.pushEnabled) {
      await sendPushNotification(message);
    }

    await updateAlertForUser(alert.id, alert.userId ?? "", (current) => ({
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
