import postgres from "postgres";

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

type AlertRow = {
  id: string;
  name: string;
  origin_address: string;
  destination_address: string;
  enabled: boolean;
  max_duration_minutes: number | null;
  min_delay_minutes: number | null;
  severe_weather_required: boolean;
  incident_keyword_filter: string | null;
  days_of_week_csv: string;
  start_time: string;
  end_time: string;
  cooldown_minutes: number;
  min_consecutive_triggers: number;
  sms_enabled: boolean;
  push_enabled: boolean;
  sms_phone_number: string | null;
  last_notified_at: Date | null;
  last_triggered_at: Date | null;
  consecutive_trigger_count: number;
  created_at: Date;
  updated_at: Date;
};

type AlertCheckRow = {
  id: string;
  alert_id: string;
  checked_at: Date;
  triggered: boolean;
  trigger_reasons: string;
  travel_duration_minutes: number;
  baseline_duration_minutes: number;
  delay_minutes: number;
  weather_summary: string;
  incident_summary: string;
};

function getClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is missing. Set it to your Neon pooled Postgres URL.");
  }
  return postgres(connectionString, {
    ssl: "require",
    max: 1
  });
}

let sqlClient: ReturnType<typeof postgres> | null = null;

function sql() {
  if (!sqlClient) {
    sqlClient = getClient();
  }
  return sqlClient;
}
let initPromise: Promise<void> | null = null;

async function ensureSchema(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await sql().begin(async (tx) => {
        await tx.unsafe("SELECT pg_advisory_xact_lock($1)", [927130221]);
        await tx.unsafe(`
          CREATE TABLE IF NOT EXISTS alerts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            origin_address TEXT NOT NULL,
            destination_address TEXT NOT NULL,
            enabled BOOLEAN NOT NULL DEFAULT TRUE,
            max_duration_minutes INTEGER NULL,
            min_delay_minutes INTEGER NULL,
            severe_weather_required BOOLEAN NOT NULL DEFAULT FALSE,
            incident_keyword_filter TEXT NULL,
            days_of_week_csv TEXT NOT NULL DEFAULT '1,2,3,4,5',
            start_time TEXT NOT NULL DEFAULT '06:00',
            end_time TEXT NOT NULL DEFAULT '10:00',
            cooldown_minutes INTEGER NOT NULL DEFAULT 45,
            min_consecutive_triggers INTEGER NOT NULL DEFAULT 1,
            sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
            push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            sms_phone_number TEXT NULL,
            last_notified_at TIMESTAMPTZ NULL,
            last_triggered_at TIMESTAMPTZ NULL,
            consecutive_trigger_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
        await tx.unsafe(`
          CREATE TABLE IF NOT EXISTS alert_checks (
            id TEXT PRIMARY KEY,
            alert_id TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
            checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            triggered BOOLEAN NOT NULL,
            trigger_reasons TEXT NOT NULL,
            travel_duration_minutes INTEGER NOT NULL,
            baseline_duration_minutes INTEGER NOT NULL,
            delay_minutes INTEGER NOT NULL,
            weather_summary TEXT NOT NULL,
            incident_summary TEXT NOT NULL
          );
        `);
        await tx.unsafe(`
          CREATE INDEX IF NOT EXISTS idx_alert_checks_alert_id_checked_at
          ON alert_checks(alert_id, checked_at DESC);
        `);
      });
    })();
  }
  try {
    await initPromise;
  } catch (error) {
    initPromise = null;
    throw error;
  }
}

function mapAlert(row: AlertRow): Alert {
  return {
    id: row.id,
    name: row.name,
    originAddress: row.origin_address,
    destinationAddress: row.destination_address,
    enabled: row.enabled,
    maxDurationMinutes: row.max_duration_minutes,
    minDelayMinutes: row.min_delay_minutes,
    severeWeatherRequired: row.severe_weather_required,
    incidentKeywordFilter: row.incident_keyword_filter,
    daysOfWeekCsv: row.days_of_week_csv,
    startTime: row.start_time,
    endTime: row.end_time,
    cooldownMinutes: row.cooldown_minutes,
    minConsecutiveTriggers: row.min_consecutive_triggers,
    smsEnabled: row.sms_enabled,
    pushEnabled: row.push_enabled,
    smsPhoneNumber: row.sms_phone_number,
    lastNotifiedAt: row.last_notified_at ? row.last_notified_at.toISOString() : null,
    lastTriggeredAt: row.last_triggered_at ? row.last_triggered_at.toISOString() : null,
    consecutiveTriggerCount: row.consecutive_trigger_count,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function mapCheck(row: AlertCheckRow): AlertCheck {
  return {
    id: row.id,
    alertId: row.alert_id,
    checkedAt: row.checked_at.toISOString(),
    triggered: row.triggered,
    triggerReasons: row.trigger_reasons,
    travelDurationMinutes: row.travel_duration_minutes,
    baselineDurationMinutes: row.baseline_duration_minutes,
    delayMinutes: row.delay_minutes,
    weatherSummary: row.weather_summary,
    incidentSummary: row.incident_summary
  };
}

export async function listAlerts(): Promise<Alert[]> {
  await ensureSchema();
  const rows = await sql()<AlertRow[]>`SELECT * FROM alerts ORDER BY created_at DESC`;
  return rows.map(mapAlert);
}

export async function createAlert(input: Omit<Alert, "id" | "createdAt" | "updatedAt">): Promise<Alert> {
  await ensureSchema();
  const id = crypto.randomUUID();
  const rows = await sql()<AlertRow[]>`
    INSERT INTO alerts (
      id, name, origin_address, destination_address, enabled, max_duration_minutes, min_delay_minutes,
      severe_weather_required, incident_keyword_filter, days_of_week_csv, start_time, end_time,
      cooldown_minutes, min_consecutive_triggers, sms_enabled, push_enabled, sms_phone_number,
      last_notified_at, last_triggered_at, consecutive_trigger_count
    ) VALUES (
      ${id}, ${input.name}, ${input.originAddress}, ${input.destinationAddress}, ${input.enabled},
      ${input.maxDurationMinutes}, ${input.minDelayMinutes}, ${input.severeWeatherRequired},
      ${input.incidentKeywordFilter}, ${input.daysOfWeekCsv}, ${input.startTime}, ${input.endTime},
      ${input.cooldownMinutes}, ${input.minConsecutiveTriggers}, ${input.smsEnabled},
      ${input.pushEnabled}, ${input.smsPhoneNumber}, ${input.lastNotifiedAt}, ${input.lastTriggeredAt},
      ${input.consecutiveTriggerCount}
    )
    RETURNING *
  `;
  return mapAlert(rows[0]);
}

async function getAlertById(id: string): Promise<Alert | null> {
  await ensureSchema();
  const rows = await sql()<AlertRow[]>`SELECT * FROM alerts WHERE id = ${id} LIMIT 1`;
  return rows[0] ? mapAlert(rows[0]) : null;
}

export async function updateAlert(
  id: string,
  updater: (current: Alert) => Alert
): Promise<Alert | null> {
  const current = await getAlertById(id);
  if (!current) {
    return null;
  }

  const next = updater(current);
  await ensureSchema();
  const rows = await sql()<AlertRow[]>`
    UPDATE alerts
    SET
      name = ${next.name},
      origin_address = ${next.originAddress},
      destination_address = ${next.destinationAddress},
      enabled = ${next.enabled},
      max_duration_minutes = ${next.maxDurationMinutes},
      min_delay_minutes = ${next.minDelayMinutes},
      severe_weather_required = ${next.severeWeatherRequired},
      incident_keyword_filter = ${next.incidentKeywordFilter},
      days_of_week_csv = ${next.daysOfWeekCsv},
      start_time = ${next.startTime},
      end_time = ${next.endTime},
      cooldown_minutes = ${next.cooldownMinutes},
      min_consecutive_triggers = ${next.minConsecutiveTriggers},
      sms_enabled = ${next.smsEnabled},
      push_enabled = ${next.pushEnabled},
      sms_phone_number = ${next.smsPhoneNumber},
      last_notified_at = ${next.lastNotifiedAt},
      last_triggered_at = ${next.lastTriggeredAt},
      consecutive_trigger_count = ${next.consecutiveTriggerCount},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ? mapAlert(rows[0]) : null;
}

export async function deleteAlert(id: string): Promise<boolean> {
  await ensureSchema();
  const rows = await sql()`DELETE FROM alerts WHERE id = ${id}`;
  return rows.count > 0;
}

export async function addCheck(check: Omit<AlertCheck, "id" | "checkedAt">): Promise<AlertCheck> {
  await ensureSchema();
  const id = crypto.randomUUID();
  const rows = await sql()<AlertCheckRow[]>`
    INSERT INTO alert_checks (
      id, alert_id, triggered, trigger_reasons, travel_duration_minutes,
      baseline_duration_minutes, delay_minutes, weather_summary, incident_summary
    ) VALUES (
      ${id}, ${check.alertId}, ${check.triggered}, ${check.triggerReasons},
      ${check.travelDurationMinutes}, ${check.baselineDurationMinutes}, ${check.delayMinutes},
      ${check.weatherSummary}, ${check.incidentSummary}
    )
    RETURNING *
  `;
  return mapCheck(rows[0]);
}

export async function latestCheckByAlertId(alertId: string): Promise<AlertCheck | null> {
  await ensureSchema();
  const rows =
    await sql()<AlertCheckRow[]>`SELECT * FROM alert_checks WHERE alert_id = ${alertId} ORDER BY checked_at DESC LIMIT 1`;
  return rows[0] ? mapCheck(rows[0]) : null;
}
