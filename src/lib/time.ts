export function parseHm(time: string): number {
  const [h, m] = time.split(":").map((v) => Number.parseInt(v, 10));
  return h * 60 + m;
}

type LocalTimeParts = {
  weekday: number;
  minutes: number;
};

const weekdayMap: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7
};

function getLocalTimeParts(now: Date, timeZone: string): LocalTimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);

  const weekdayShort = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number.parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = Number.parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);

  return {
    weekday: weekdayMap[weekdayShort] ?? 1,
    minutes: hour * 60 + minute
  };
}

export function isNowInWindow(
  startTime: string,
  endTime: string,
  now = new Date(),
  timeZone = "America/Los_Angeles"
): boolean {
  const nowMinutes = getLocalTimeParts(now, timeZone).minutes;
  const startMinutes = parseHm(startTime);
  const endMinutes = parseHm(endTime);

  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
  }

  return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
}

export function weekdayNumber(now = new Date(), timeZone = "America/Los_Angeles"): number {
  return getLocalTimeParts(now, timeZone).weekday;
}
