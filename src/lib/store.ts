import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type Alert = {
  id: string;
  name: string;
  originAddress: string;
  destinationAddress: string;
  enabled: boolean;
  maxDurationMinutes: number | null;
  minDelayMinutes: number | null;
  severeWeatherRequired: boolean;
  incidentKeywordFilter: string | null;
  daysOfWeekCsv: string;
  startTime: string;
  endTime: string;
  cooldownMinutes: number;
  minConsecutiveTriggers: number;
  smsEnabled: boolean;
  pushEnabled: boolean;
  smsPhoneNumber: string | null;
  lastNotifiedAt: string | null;
  lastTriggeredAt: string | null;
  consecutiveTriggerCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AlertCheck = {
  id: string;
  alertId: string;
  checkedAt: string;
  triggered: boolean;
  triggerReasons: string;
  travelDurationMinutes: number;
  baselineDurationMinutes: number;
  delayMinutes: number;
  weatherSummary: string;
  incidentSummary: string;
};

export type PushSubscriptionRecord = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
};

type Store = {
  alerts: Alert[];
  checks: AlertCheck[];
  pushSubscriptions: PushSubscriptionRecord[];
};

const STORE_FILE = path.join(process.cwd(), "data", "store.json");

const defaultStore: Store = {
  alerts: [],
  checks: [],
  pushSubscriptions: []
};

async function ensureStoreFile() {
  const dir = path.dirname(STORE_FILE);
  await mkdir(dir, { recursive: true });
  try {
    await readFile(STORE_FILE, "utf8");
  } catch {
    await writeFile(STORE_FILE, JSON.stringify(defaultStore, null, 2), "utf8");
  }
}

async function readStore(): Promise<Store> {
  await ensureStoreFile();
  const raw = await readFile(STORE_FILE, "utf8");
  return JSON.parse(raw) as Store;
}

async function writeStore(store: Store): Promise<void> {
  await writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function listAlerts(): Promise<Alert[]> {
  const store = await readStore();
  return [...store.alerts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createAlert(input: Omit<Alert, "id" | "createdAt" | "updatedAt">): Promise<Alert> {
  const store = await readStore();
  const now = new Date().toISOString();
  const alert: Alert = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now
  };
  store.alerts.push(alert);
  await writeStore(store);
  return alert;
}

export async function updateAlert(
  id: string,
  updater: (current: Alert) => Alert
): Promise<Alert | null> {
  const store = await readStore();
  const index = store.alerts.findIndex((a) => a.id === id);
  if (index === -1) {
    return null;
  }
  const next = updater(store.alerts[index]);
  next.updatedAt = new Date().toISOString();
  store.alerts[index] = next;
  await writeStore(store);
  return next;
}

export async function deleteAlert(id: string): Promise<boolean> {
  const store = await readStore();
  const oldLength = store.alerts.length;
  store.alerts = store.alerts.filter((a) => a.id !== id);
  store.checks = store.checks.filter((c) => c.alertId !== id);
  await writeStore(store);
  return store.alerts.length !== oldLength;
}

export async function addCheck(check: Omit<AlertCheck, "id" | "checkedAt">): Promise<AlertCheck> {
  const store = await readStore();
  const next: AlertCheck = {
    ...check,
    id: crypto.randomUUID(),
    checkedAt: new Date().toISOString()
  };
  store.checks.push(next);
  await writeStore(store);
  return next;
}

export async function latestCheckByAlertId(alertId: string): Promise<AlertCheck | null> {
  const store = await readStore();
  const checks = store.checks
    .filter((c) => c.alertId === alertId)
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
  return checks[0] ?? null;
}

export async function listPushSubscriptions(): Promise<PushSubscriptionRecord[]> {
  const store = await readStore();
  return store.pushSubscriptions;
}

export async function upsertPushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  const store = await readStore();
  const existing = store.pushSubscriptions.find((s) => s.endpoint === input.endpoint);
  if (existing) {
    existing.p256dh = input.p256dh;
    existing.auth = input.auth;
  } else {
    store.pushSubscriptions.push({
      id: crypto.randomUUID(),
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      createdAt: new Date().toISOString()
    });
  }
  await writeStore(store);
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  const store = await readStore();
  store.pushSubscriptions = store.pushSubscriptions.filter((s) => s.endpoint !== endpoint);
  await writeStore(store);
}
