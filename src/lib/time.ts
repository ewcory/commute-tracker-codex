export function parseHm(time: string): number {
  const [h, m] = time.split(":").map((v) => Number.parseInt(v, 10));
  return h * 60 + m;
}

export function isNowInWindow(startTime: string, endTime: string, now = new Date()): boolean {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = parseHm(startTime);
  const endMinutes = parseHm(endTime);

  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
  }

  return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
}

export function weekdayNumber(now = new Date()): number {
  const day = now.getDay();
  return day === 0 ? 7 : day;
}
