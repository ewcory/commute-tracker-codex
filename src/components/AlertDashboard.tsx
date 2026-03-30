"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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
  smsEnabled: boolean;
  pushEnabled: boolean;
  smsPhoneNumber: string | null;
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

type NewAlertForm = {
  name: string;
  originAddress: string;
  destinationAddress: string;
  maxDurationMinutes: string;
  minDelayMinutes: string;
  severeWeatherRequired: boolean;
  incidentKeywordFilter: string;
  daysOfWeekCsv: string;
  startTime: string;
  endTime: string;
  cooldownMinutes: string;
  minConsecutiveTriggers: string;
  smsEnabled: boolean;
  pushEnabled: boolean;
  smsPhoneNumber: string;
};

const defaultForm: NewAlertForm = {
  name: "Morning commute SF -> Emeryville",
  originAddress: "San Francisco, CA",
  destinationAddress: "Emeryville, CA",
  maxDurationMinutes: "45",
  minDelayMinutes: "15",
  severeWeatherRequired: false,
  incidentKeywordFilter: "bay bridge",
  daysOfWeekCsv: "1,2,3,4,5",
  startTime: "06:00",
  endTime: "10:00",
  cooldownMinutes: "45",
  minConsecutiveTriggers: "1",
  smsEnabled: false,
  pushEnabled: true,
  smsPhoneNumber: ""
};

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
  const [form, setForm] = useState<NewAlertForm>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Loading...");

  const instructions = useMemo(
    () =>
      [
        "Days format uses 1-7 (1=Monday, 7=Sunday). Example: 1,2,3,4,5",
        "Time window uses 24-hour format, like 06:00 to 10:00",
        "You can enable both SMS and push notifications for the same alert"
      ].join(" | "),
    []
  );

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
    setStatus(authMode === "login" ? "Logging in..." : "Creating account...");
    try {
      const path = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const data = await jsonFetch<{ user: AppUser }>(path, {
        method: "POST",
        body: JSON.stringify({ username, password })
      });
      setUser(data.user);
      setPassword("");
      setStatus(`Welcome, ${data.user.username}.`);
      await loadAuthAndAlerts();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setStatus("Logging out...");
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

  async function onCreateAlert(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus("Creating alert...");
    try {
      await jsonFetch("/api/alerts", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          maxDurationMinutes: form.maxDurationMinutes ? Number(form.maxDurationMinutes) : null,
          minDelayMinutes: form.minDelayMinutes ? Number(form.minDelayMinutes) : null,
          cooldownMinutes: Number(form.cooldownMinutes),
          minConsecutiveTriggers: Number(form.minConsecutiveTriggers),
          incidentKeywordFilter: form.incidentKeywordFilter || null,
          smsPhoneNumber: form.smsPhoneNumber || null
        })
      });
      setStatus("Alert created.");
      setForm(defaultForm);
      await loadAlerts();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create alert");
    } finally {
      setLoading(false);
    }
  }

  async function toggleAlert(alert: Alert) {
    setStatus(`Updating ${alert.name}...`);
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
    setStatus(`Deleting ${alert.name}...`);
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
    setStatus("Sending test ntfy notification...");
    try {
      await jsonFetch("/api/test-notification", { method: "POST" });
      setStatus("Test notification sent. Check your ntfy app topic.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send test notification");
    }
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
              <button
                type="button"
                onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
              >
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
        <h1>Commute Alert Control Panel</h1>
        <p>Logged in as <strong>{user.username}</strong>.</p>
        <p>
          Configure multiple traffic alerts powered by Google Maps travel-time traffic, optional Bay Bridge
          incident keyword checks, and severe weather filtering.
        </p>
        <p>Push notifications are sent via ntfy when `NTFY_TOPIC` is set in your environment variables.</p>
        <p className="hint">{instructions}</p>
        <div className="row">
          <button type="button" onClick={checkNow}>
            Run Check Now
          </button>
          <button type="button" onClick={sendTestNotification}>
            Send Test Notification
          </button>
          <button type="button" onClick={logout}>
            Log Out
          </button>
        </div>
        <p className="status">{status}</p>
      </section>

      <section className="card">
        <h2>Create New Alert</h2>
        <form onSubmit={onCreateAlert} className="form">
          <label>
            Alert name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label>
            Origin address (home)
            <input
              value={form.originAddress}
              onChange={(e) => setForm({ ...form, originAddress: e.target.value })}
              required
            />
          </label>
          <label>
            Destination address (work)
            <input
              value={form.destinationAddress}
              onChange={(e) => setForm({ ...form, destinationAddress: e.target.value })}
              required
            />
          </label>
          <div className="grid2">
            <label>
              Max commute minutes
              <input
                type="number"
                min={1}
                value={form.maxDurationMinutes}
                onChange={(e) => setForm({ ...form, maxDurationMinutes: e.target.value })}
              />
            </label>
            <label>
              Min delay minutes
              <input
                type="number"
                min={0}
                value={form.minDelayMinutes}
                onChange={(e) => setForm({ ...form, minDelayMinutes: e.target.value })}
              />
            </label>
          </div>
          <div className="grid2">
            <label>
              Days (1-7 CSV)
              <input
                value={form.daysOfWeekCsv}
                onChange={(e) => setForm({ ...form, daysOfWeekCsv: e.target.value })}
                required
              />
            </label>
            <label>
              Bay Bridge incident keyword
              <input
                value={form.incidentKeywordFilter}
                onChange={(e) => setForm({ ...form, incidentKeywordFilter: e.target.value })}
                placeholder="bay bridge"
              />
            </label>
          </div>
          <div className="grid3">
            <label>
              Start time
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              />
            </label>
            <label>
              End time
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              />
            </label>
            <label>
              Cooldown minutes
              <input
                type="number"
                min={1}
                value={form.cooldownMinutes}
                onChange={(e) => setForm({ ...form, cooldownMinutes: e.target.value })}
              />
            </label>
          </div>
          <div className="grid3">
            <label>
              Consecutive trigger checks required
              <input
                type="number"
                min={1}
                value={form.minConsecutiveTriggers}
                onChange={(e) => setForm({ ...form, minConsecutiveTriggers: e.target.value })}
              />
            </label>
            <label>
              SMS phone number
              <input
                value={form.smsPhoneNumber}
                onChange={(e) => setForm({ ...form, smsPhoneNumber: e.target.value })}
                placeholder="+14155550123"
              />
            </label>
            <div className="checkboxes">
              <label>
                <input
                  type="checkbox"
                  checked={form.smsEnabled}
                  onChange={(e) => setForm({ ...form, smsEnabled: e.target.checked })}
                />
                SMS enabled
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.pushEnabled}
                  onChange={(e) => setForm({ ...form, pushEnabled: e.target.checked })}
                />
                Push enabled
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.severeWeatherRequired}
                  onChange={(e) => setForm({ ...form, severeWeatherRequired: e.target.checked })}
                />
                Require severe weather
              </label>
            </div>
          </div>
          <button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Create Alert"}
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
                  <p>
                    {alert.originAddress} to {alert.destinationAddress}
                  </p>
                  <p>
                    Window: {alert.startTime}-{alert.endTime} | Days: {alert.daysOfWeekCsv} | Max:{" "}
                    {alert.maxDurationMinutes ?? "n/a"}m | Delay: {alert.minDelayMinutes ?? "n/a"}m
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
                  <button type="button" onClick={() => deleteAlert(alert)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
