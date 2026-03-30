"use client";

import { FormEvent, useEffect, useState } from "react";

type Alert = {
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
  rapidIncreaseEnabled: boolean;
  rapidIncreaseMinRiseMinutes: number;
  rapidIncreaseLookaheadMinutes: number;
  pushEnabled: boolean;
  checks?: Array<{
    triggered: boolean;
    triggerReasons: string;
    checkedAt: string;
  }>;
};

type AppUser = {
  id: string;
  username: string;
};

type CommuteSection = {
  startTime: string;
  endTime: string;
  maxDurationMinutes: string;
  minDelayMinutes: string;
  rapidIncreaseEnabled: boolean;
  rapidIncreaseMinRiseMinutes: string;
  rapidIncreaseLookaheadMinutes: string;
};

type SetupForm = {
  homeAddress: string;
  workAddress: string;
  daysOfWeek: number[];
  incidentKeywordFilter: string;
  severeWeatherRequired: boolean;
  cooldownMinutes: string;
  minConsecutiveTriggers: string;
  pushEnabled: boolean;
  morning: CommuteSection;
  afternoon: CommuteSection;
};

const defaultForm: SetupForm = {
  homeAddress: "San Francisco, CA",
  workAddress: "Emeryville, CA",
  daysOfWeek: [1, 2, 3, 4, 5],
  incidentKeywordFilter: "bay bridge",
  severeWeatherRequired: false,
  cooldownMinutes: "45",
  minConsecutiveTriggers: "1",
  pushEnabled: true,
  morning: {
    startTime: "06:00",
    endTime: "10:00",
    maxDurationMinutes: "45",
    minDelayMinutes: "12",
    rapidIncreaseEnabled: true,
    rapidIncreaseMinRiseMinutes: "5",
    rapidIncreaseLookaheadMinutes: "20"
  },
  afternoon: {
    startTime: "15:00",
    endTime: "19:00",
    maxDurationMinutes: "50",
    minDelayMinutes: "12",
    rapidIncreaseEnabled: true,
    rapidIncreaseMinRiseMinutes: "5",
    rapidIncreaseLookaheadMinutes: "20"
  }
};

const dayOptions = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" }
];

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(String(body.error ?? `Request failed (${res.status})`));
  }
  return (await res.json()) as T;
}

export function AlertDashboard() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [form, setForm] = useState<SetupForm>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Loading...");

  async function loadAuthAndAlerts() {
    try {
      const me = await jsonFetch<{ user: AppUser }>("/api/auth/me");
      setUser(me.user);
      const data = await jsonFetch<{ alerts: Alert[] }>("/api/alerts");
      setAlerts(data.alerts);
      setStatus(`Loaded ${data.alerts.length} alert(s).`);
    } catch {
      setUser(null);
      setAlerts([]);
      setStatus("Please log in.");
    }
  }

  useEffect(() => {
    loadAuthAndAlerts();
  }, []);

  async function onAuthSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const path = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      await jsonFetch(path, {
        method: "POST",
        body: JSON.stringify({ username, password })
      });
      setPassword("");
      await loadAuthAndAlerts();
      setStatus(`Welcome, ${username}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await jsonFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setAlerts([]);
    setStatus("Logged out.");
  }

  async function loadAlerts() {
    const data = await jsonFetch<{ alerts: Alert[] }>("/api/alerts");
    setAlerts(data.alerts);
    setStatus(`Loaded ${data.alerts.length} alert(s).`);
  }

  async function createMorningAndAfternoonAlerts(e: FormEvent) {
    e.preventDefault();
    if (form.daysOfWeek.length === 0) {
      setStatus("Please select at least one day.");
      return;
    }
    setLoading(true);
    setStatus("Creating morning and afternoon alerts...");

    const common = {
      daysOfWeekCsv: [...form.daysOfWeek].sort((a, b) => a - b).join(","),
      incidentKeywordFilter: form.incidentKeywordFilter || null,
      severeWeatherRequired: form.severeWeatherRequired,
      cooldownMinutes: Number(form.cooldownMinutes),
      minConsecutiveTriggers: Number(form.minConsecutiveTriggers),
      pushEnabled: form.pushEnabled
    };

    try {
      await jsonFetch("/api/alerts", {
        method: "POST",
        body: JSON.stringify({
          ...common,
          name: "Morning commute: Home -> Work",
          originAddress: form.homeAddress,
          destinationAddress: form.workAddress,
          startTime: form.morning.startTime,
          endTime: form.morning.endTime,
          maxDurationMinutes: Number(form.morning.maxDurationMinutes),
          minDelayMinutes: Number(form.morning.minDelayMinutes),
          rapidIncreaseEnabled: form.morning.rapidIncreaseEnabled,
          rapidIncreaseMinRiseMinutes: Number(form.morning.rapidIncreaseMinRiseMinutes),
          rapidIncreaseLookaheadMinutes: Number(form.morning.rapidIncreaseLookaheadMinutes)
        })
      });

      await jsonFetch("/api/alerts", {
        method: "POST",
        body: JSON.stringify({
          ...common,
          name: "Afternoon commute: Work -> Home",
          originAddress: form.workAddress,
          destinationAddress: form.homeAddress,
          startTime: form.afternoon.startTime,
          endTime: form.afternoon.endTime,
          maxDurationMinutes: Number(form.afternoon.maxDurationMinutes),
          minDelayMinutes: Number(form.afternoon.minDelayMinutes),
          rapidIncreaseEnabled: form.afternoon.rapidIncreaseEnabled,
          rapidIncreaseMinRiseMinutes: Number(form.afternoon.rapidIncreaseMinRiseMinutes),
          rapidIncreaseLookaheadMinutes: Number(form.afternoon.rapidIncreaseLookaheadMinutes)
        })
      });

      setStatus("Both alerts created.");
      await loadAlerts();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create alerts");
    } finally {
      setLoading(false);
    }
  }

  function toggleDay(day: number) {
    const selected = form.daysOfWeek.includes(day);
    const next = selected
      ? form.daysOfWeek.filter((d) => d !== day)
      : [...form.daysOfWeek, day];
    setForm({ ...form, daysOfWeek: next });
  }

  async function toggleAlert(alert: Alert) {
    await jsonFetch(`/api/alerts/${alert.id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !alert.enabled })
    });
    await loadAlerts();
  }

  async function deleteAlert(alert: Alert) {
    if (!window.confirm(`Delete alert "${alert.name}"?`)) {
      return;
    }
    await jsonFetch(`/api/alerts/${alert.id}`, { method: "DELETE" });
    await loadAlerts();
  }

  async function checkNow() {
    setStatus("Running alert checks now...");
    try {
      const data = await jsonFetch<{ results: Array<{ triggered: boolean }> }>("/api/check-now", {
        method: "POST"
      });
      const triggeredCount = data.results.filter((r) => r.triggered).length;
      setStatus(`Check complete. ${triggeredCount} alert(s) triggered.`);
      await loadAlerts();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Check failed");
    }
  }

  async function sendTestNotification() {
    await jsonFetch("/api/test-notification", { method: "POST" });
    setStatus("Test notification sent. Check ntfy.");
  }

  if (!user) {
    return (
      <main className="container">
        <section className="card">
          <h1>Commute Alert Login</h1>
          <p>Create an account once, then log in with username/password.</p>
          <form onSubmit={onAuthSubmit} className="form">
            <label>
              Username
              <input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} />
            </label>
            <label>
              Password
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                minLength={8}
              />
            </label>
            <div className="row">
              <button type="submit" disabled={loading}>
                {authMode === "login" ? "Log In" : "Create Account"}
              </button>
              <button type="button" onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>
                Switch to {authMode === "login" ? "Register" : "Login"}
              </button>
            </div>
          </form>
          <p className="status">{status}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="container">
      <section className="card">
        <h1>Commute Alert Tool</h1>
        <p>Logged in as <strong>{user.username}</strong>.</p>
        <p className="hint">
          This tool creates two alerts: one for morning (Home to Work) and one for afternoon
          (Work to Home).
        </p>
        <div className="row">
          <button type="button" onClick={checkNow}>Run Check Now</button>
          <button type="button" onClick={sendTestNotification}>Send Test Notification</button>
          <button type="button" onClick={logout}>Log Out</button>
        </div>
        <p className="status">{status}</p>
      </section>

      <section className="card">
        <h2>Field Guide</h2>
        <p><strong>Home address:</strong> where you start in the morning and end in the afternoon.</p>
        <p><strong>Work address:</strong> where you end in the morning and start in the afternoon.</p>
        <p><strong>Days (1-7):</strong> weekdays to monitor. 1=Mon ... 7=Sun.</p>
        <p><strong>Start/End time:</strong> monitoring window for that commute period.</p>
        <p><strong>Commute threshold (minutes):</strong> alert when current commute is at/above this.</p>
        <p><strong>Extra delay threshold (minutes):</strong> how much slower than normal traffic must be before triggering. Example: if normal is 25m and now is 38m, extra delay is 13m.</p>
        <p><strong>Rapid increase:</strong> alerts earlier if trend suggests threshold will be exceeded soon.</p>
        <p><strong>Min rise since last check:</strong> how much increase counts as "rapid".</p>
        <p><strong>Lookahead minutes:</strong> how far ahead to project the current trend.</p>
        <p><strong>Cooldown:</strong> minimum minutes between notifications for same alert.</p>
        <p><strong>Consecutive checks required:</strong> condition must be true this many checks in a row.</p>
        <p><strong>Bay Bridge keyword:</strong> incident text filter, e.g. <code>bay bridge</code>.</p>
        <p><strong>Require severe weather:</strong> only trigger when severe weather is active.</p>
        <p><strong>Push enabled:</strong> send ntfy push notification.</p>
      </section>

      <section className="card">
        <h2>Create Morning + Afternoon Alerts</h2>
        <form onSubmit={createMorningAndAfternoonAlerts} className="form">
          <div className="grid2">
            <label>
              Home address
              <input
                value={form.homeAddress}
                onChange={(e) => setForm({ ...form, homeAddress: e.target.value })}
                required
              />
            </label>
            <label>
              Work address
              <input
                value={form.workAddress}
                onChange={(e) => setForm({ ...form, workAddress: e.target.value })}
                required
              />
            </label>
          </div>

          <h3>Morning Commute (Home -&gt; Work)</h3>
          <CommuteSectionEditor
            value={form.morning}
            onChange={(morning) => setForm({ ...form, morning })}
          />

          <h3>Afternoon Commute (Work -&gt; Home)</h3>
          <CommuteSectionEditor
            value={form.afternoon}
            onChange={(afternoon) => setForm({ ...form, afternoon })}
          />

          <h3>Shared Settings (Applied to Both)</h3>
          <div>
            <p><strong>Active days</strong></p>
            <div className="row">
              {dayOptions.map((day) => (
                <label key={day.value}>
                  <input
                    type="checkbox"
                    checked={form.daysOfWeek.includes(day.value)}
                    onChange={() => toggleDay(day.value)}
                  />
                  {day.label}
                </label>
              ))}
            </div>
          </div>
          <div className="grid3">
            <label>
              Cooldown minutes
              <input
                type="number"
                min={1}
                value={form.cooldownMinutes}
                onChange={(e) => setForm({ ...form, cooldownMinutes: e.target.value })}
              />
            </label>
            <label>
              Consecutive checks required
              <input
                type="number"
                min={1}
                value={form.minConsecutiveTriggers}
                onChange={(e) => setForm({ ...form, minConsecutiveTriggers: e.target.value })}
              />
            </label>
          </div>
          <div className="grid2">
            <label>
              Bay Bridge incident keyword
              <input
                value={form.incidentKeywordFilter}
                onChange={(e) => setForm({ ...form, incidentKeywordFilter: e.target.value })}
              />
            </label>
          </div>
          <div className="checkboxes">
            <label>
              <input
                type="checkbox"
                checked={form.severeWeatherRequired}
                onChange={(e) => setForm({ ...form, severeWeatherRequired: e.target.checked })}
              />
              Require severe weather
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.pushEnabled}
                onChange={(e) => setForm({ ...form, pushEnabled: e.target.checked })}
              />
              Push enabled
            </label>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Create Morning + Afternoon Alerts"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Existing Alerts</h2>
        {alerts.length === 0 ? (
          <p>No alerts yet.</p>
        ) : (
          <ul className="alerts">
            {alerts.map((alert) => (
              <li key={alert.id}>
                <div>
                  <strong>{alert.name}</strong>
                  <p>{alert.originAddress} to {alert.destinationAddress}</p>
                  <p>
                    Window: {alert.startTime}-{alert.endTime} | Threshold: {alert.maxDurationMinutes ?? "n/a"}m |
                    Extra delay: {alert.minDelayMinutes ?? "n/a"}m
                  </p>
                  <p>
                    Rapid rise: {alert.rapidIncreaseEnabled ? "On" : "Off"} | Min rise: {alert.rapidIncreaseMinRiseMinutes}m |
                    Lookahead: {alert.rapidIncreaseLookaheadMinutes}m
                  </p>
                  <p>
                    Last check:{" "}
                    {alert.checks?.[0]
                      ? `${new Date(alert.checks[0].checkedAt).toLocaleString()} (${alert.checks[0].triggered ? "Triggered" : "No trigger"})`
                      : "No checks yet"}
                  </p>
                  {alert.checks?.[0] ? <p>Reason: {alert.checks[0].triggerReasons}</p> : null}
                </div>
                <div className="row">
                  <button type="button" onClick={() => toggleAlert(alert)}>
                    {alert.enabled ? "Disable" : "Enable"}
                  </button>
                  <button type="button" onClick={() => deleteAlert(alert)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function CommuteSectionEditor({
  value,
  onChange
}: {
  value: CommuteSection;
  onChange: (value: CommuteSection) => void;
}) {
  return (
    <>
      <div className="grid3">
        <label>
          Start time
          <input
            type="time"
            value={value.startTime}
            onChange={(e) => onChange({ ...value, startTime: e.target.value })}
          />
        </label>
        <label>
          End time
          <input
            type="time"
            value={value.endTime}
            onChange={(e) => onChange({ ...value, endTime: e.target.value })}
          />
        </label>
        <label>
          Commute threshold (minutes)
          <input
            type="number"
            min={1}
            value={value.maxDurationMinutes}
            onChange={(e) => onChange({ ...value, maxDurationMinutes: e.target.value })}
          />
        </label>
      </div>
      <div className="grid3">
        <label>
          Extra delay threshold (minutes)
          <input
            type="number"
            min={0}
            value={value.minDelayMinutes}
            onChange={(e) => onChange({ ...value, minDelayMinutes: e.target.value })}
          />
        </label>
        <label>
          Min rise since last check (minutes)
          <input
            type="number"
            min={1}
            value={value.rapidIncreaseMinRiseMinutes}
            onChange={(e) => onChange({ ...value, rapidIncreaseMinRiseMinutes: e.target.value })}
          />
        </label>
        <label>
          Lookahead (minutes)
          <input
            type="number"
            min={5}
            value={value.rapidIncreaseLookaheadMinutes}
            onChange={(e) => onChange({ ...value, rapidIncreaseLookaheadMinutes: e.target.value })}
          />
        </label>
      </div>
      <div className="checkboxes">
        <label>
          <input
            type="checkbox"
            checked={value.rapidIncreaseEnabled}
            onChange={(e) => onChange({ ...value, rapidIncreaseEnabled: e.target.checked })}
          />
          Enable rapid-increase prediction
        </label>
      </div>
    </>
  );
}
