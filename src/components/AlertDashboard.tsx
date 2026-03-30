"use client";

import { FormEvent, useEffect, useState } from "react";

import { AddressAutocompleteInput } from "@/components/AddressAutocompleteInput";

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

type AlertEditDraft = {
  name: string;
  originAddress: string;
  destinationAddress: string;
  startTime: string;
  endTime: string;
  maxDurationMinutes: string;
  minDelayMinutes: string;
  rapidIncreaseEnabled: boolean;
  rapidIncreaseMinRiseMinutes: string;
  rapidIncreaseLookaheadMinutes: string;
  daysOfWeek: number[];
  incidentKeywordFilter: string;
  severeWeatherRequired: boolean;
  cooldownMinutes: string;
  minConsecutiveTriggers: string;
  pushEnabled: boolean;
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
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<AlertEditDraft | null>(null);

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

  function beginEdit(alert: Alert) {
    setEditingAlertId(alert.id);
    setEditDraft({
      name: alert.name,
      originAddress: alert.originAddress,
      destinationAddress: alert.destinationAddress,
      startTime: alert.startTime,
      endTime: alert.endTime,
      maxDurationMinutes: alert.maxDurationMinutes?.toString() ?? "",
      minDelayMinutes: alert.minDelayMinutes?.toString() ?? "",
      rapidIncreaseEnabled: alert.rapidIncreaseEnabled,
      rapidIncreaseMinRiseMinutes: alert.rapidIncreaseMinRiseMinutes.toString(),
      rapidIncreaseLookaheadMinutes: alert.rapidIncreaseLookaheadMinutes.toString(),
      daysOfWeek: parseDaysCsv(alert.daysOfWeekCsv),
      incidentKeywordFilter: alert.incidentKeywordFilter ?? "",
      severeWeatherRequired: alert.severeWeatherRequired,
      cooldownMinutes: alert.cooldownMinutes.toString(),
      minConsecutiveTriggers: alert.minConsecutiveTriggers.toString(),
      pushEnabled: alert.pushEnabled
    });
  }

  function cancelEdit() {
    setEditingAlertId(null);
    setEditDraft(null);
  }

  function toggleEditDay(day: number) {
    if (!editDraft) return;
    const selected = editDraft.daysOfWeek.includes(day);
    const nextDays = selected
      ? editDraft.daysOfWeek.filter((d) => d !== day)
      : [...editDraft.daysOfWeek, day];
    setEditDraft({ ...editDraft, daysOfWeek: nextDays });
  }

  async function saveEdit(alertId: string) {
    if (!editDraft) return;
    if (editDraft.daysOfWeek.length === 0) {
      setStatus("Please select at least one active day.");
      return;
    }
    setStatus("Saving alert changes...");
    setLoading(true);
    try {
      await jsonFetch(`/api/alerts/${alertId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editDraft.name,
          originAddress: editDraft.originAddress,
          destinationAddress: editDraft.destinationAddress,
          startTime: editDraft.startTime,
          endTime: editDraft.endTime,
          maxDurationMinutes: editDraft.maxDurationMinutes ? Number(editDraft.maxDurationMinutes) : null,
          minDelayMinutes: editDraft.minDelayMinutes ? Number(editDraft.minDelayMinutes) : null,
          rapidIncreaseEnabled: editDraft.rapidIncreaseEnabled,
          rapidIncreaseMinRiseMinutes: Number(editDraft.rapidIncreaseMinRiseMinutes),
          rapidIncreaseLookaheadMinutes: Number(editDraft.rapidIncreaseLookaheadMinutes),
          daysOfWeekCsv: [...editDraft.daysOfWeek].sort((a, b) => a - b).join(","),
          incidentKeywordFilter: editDraft.incidentKeywordFilter || null,
          severeWeatherRequired: editDraft.severeWeatherRequired,
          cooldownMinutes: Number(editDraft.cooldownMinutes),
          minConsecutiveTriggers: Number(editDraft.minConsecutiveTriggers),
          pushEnabled: editDraft.pushEnabled
        })
      });
      setStatus("Alert updated.");
      cancelEdit();
      await loadAlerts();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save alert changes");
    } finally {
      setLoading(false);
    }
  }

  async function checkNow() {
    setStatus("Running alert checks now...");
    try {
      const data = await jsonFetch<{ results: Array<{ checked: boolean; triggered: boolean }> }>("/api/check-now", {
        method: "POST"
      });
      const triggeredCount = data.results.filter((r) => r.triggered).length;
      const checkedCount = data.results.filter((r) => r.checked).length;
      const skippedCount = data.results.length - checkedCount;
      setStatus(
        `Check complete. Checked: ${checkedCount}, skipped: ${skippedCount}, triggered: ${triggeredCount}.`
      );
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
        <h2>Create Morning + Afternoon Alerts</h2>
        <form onSubmit={createMorningAndAfternoonAlerts} className="form">
          <div className="grid2">
            <label>
              <LabelWithHelp
                label="Home address"
                help="Where you start in the morning and return in the afternoon."
              />
              <AddressAutocompleteInput
                value={form.homeAddress}
                onChange={(value) => setForm({ ...form, homeAddress: value })}
                required
              />
            </label>
            <label>
              <LabelWithHelp
                label="Work address"
                help="Where you go in the morning and start from in the afternoon."
              />
              <AddressAutocompleteInput
                value={form.workAddress}
                onChange={(value) => setForm({ ...form, workAddress: value })}
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
            <p>
              <strong>Active days</strong> <HelpTip text="Pick which days these alerts should run." />
            </p>
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
              <LabelWithHelp
                label="Cooldown minutes"
                help="Minimum wait time between notifications for the same alert."
              />
              <input
                type="number"
                min={1}
                value={form.cooldownMinutes}
                onChange={(e) => setForm({ ...form, cooldownMinutes: e.target.value })}
              />
            </label>
            <label>
              <LabelWithHelp
                label="Consecutive checks required"
                help="Condition must be true this many checks in a row before notifying."
              />
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
              <LabelWithHelp
                label="Bay Bridge incident keyword"
                help="Only incidents with this text are treated as matches. Example: bay bridge."
              />
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
              Require severe weather <HelpTip text="If enabled, alerts only trigger when severe weather is active." />
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.pushEnabled}
                onChange={(e) => setForm({ ...form, pushEnabled: e.target.checked })}
              />
              Push enabled <HelpTip text="Send notification through ntfy when this alert triggers." />
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
                  <button type="button" onClick={() => beginEdit(alert)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => toggleAlert(alert)}>
                    {alert.enabled ? "Disable" : "Enable"}
                  </button>
                  <button type="button" onClick={() => deleteAlert(alert)}>Delete</button>
                </div>
                {editingAlertId === alert.id && editDraft ? (
                  <div className="card">
                    <h3>Edit Alert</h3>
                    <div className="form">
                      <label>
                        Alert name
                        <input
                          value={editDraft.name}
                          onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                        />
                      </label>
                      <div className="grid2">
                        <label>
                          Origin address
                          <AddressAutocompleteInput
                            value={editDraft.originAddress}
                            onChange={(value) => setEditDraft({ ...editDraft, originAddress: value })}
                            required
                          />
                        </label>
                        <label>
                          Destination address
                          <AddressAutocompleteInput
                            value={editDraft.destinationAddress}
                            onChange={(value) =>
                              setEditDraft({ ...editDraft, destinationAddress: value })
                            }
                            required
                          />
                        </label>
                      </div>
                      <div className="grid3">
                        <label>
                          Start time
                          <input
                            type="time"
                            value={editDraft.startTime}
                            onChange={(e) => setEditDraft({ ...editDraft, startTime: e.target.value })}
                          />
                        </label>
                        <label>
                          End time
                          <input
                            type="time"
                            value={editDraft.endTime}
                            onChange={(e) => setEditDraft({ ...editDraft, endTime: e.target.value })}
                          />
                        </label>
                        <label>
                          Commute threshold (minutes)
                          <input
                            type="number"
                            min={1}
                            value={editDraft.maxDurationMinutes}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, maxDurationMinutes: e.target.value })
                            }
                          />
                        </label>
                      </div>
                      <div className="grid3">
                        <label>
                          Extra delay threshold (minutes)
                          <input
                            type="number"
                            min={0}
                            value={editDraft.minDelayMinutes}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, minDelayMinutes: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Min rise since last check
                          <input
                            type="number"
                            min={1}
                            value={editDraft.rapidIncreaseMinRiseMinutes}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                rapidIncreaseMinRiseMinutes: e.target.value
                              })
                            }
                          />
                        </label>
                        <label>
                          Lookahead minutes
                          <input
                            type="number"
                            min={5}
                            value={editDraft.rapidIncreaseLookaheadMinutes}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                rapidIncreaseLookaheadMinutes: e.target.value
                              })
                            }
                          />
                        </label>
                      </div>
                      <div>
                        <p><strong>Active days</strong></p>
                        <div className="row">
                          {dayOptions.map((day) => (
                            <label key={day.value}>
                              <input
                                type="checkbox"
                                checked={editDraft.daysOfWeek.includes(day.value)}
                                onChange={() => toggleEditDay(day.value)}
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
                            value={editDraft.cooldownMinutes}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, cooldownMinutes: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Consecutive checks required
                          <input
                            type="number"
                            min={1}
                            value={editDraft.minConsecutiveTriggers}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                minConsecutiveTriggers: e.target.value
                              })
                            }
                          />
                        </label>
                        <label>
                          Bay Bridge keyword
                          <input
                            value={editDraft.incidentKeywordFilter}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                incidentKeywordFilter: e.target.value
                              })
                            }
                          />
                        </label>
                      </div>
                      <div className="checkboxes">
                        <label>
                          <input
                            type="checkbox"
                            checked={editDraft.rapidIncreaseEnabled}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                rapidIncreaseEnabled: e.target.checked
                              })
                            }
                          />
                          Enable rapid-increase prediction
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={editDraft.severeWeatherRequired}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                severeWeatherRequired: e.target.checked
                              })
                            }
                          />
                          Require severe weather
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={editDraft.pushEnabled}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, pushEnabled: e.target.checked })
                            }
                          />
                          Push enabled
                        </label>
                      </div>
                      <div className="row">
                        <button type="button" onClick={() => saveEdit(alert.id)} disabled={loading}>
                          Save Changes
                        </button>
                        <button type="button" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function parseDaysCsv(csv: string): number[] {
  return csv
    .split(",")
    .map((v) => Number.parseInt(v.trim(), 10))
    .filter((v) => Number.isInteger(v) && v >= 1 && v <= 7);
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
          <LabelWithHelp
            label="Start time"
            help="When monitoring starts for this commute window."
          />
          <input
            type="time"
            value={value.startTime}
            onChange={(e) => onChange({ ...value, startTime: e.target.value })}
          />
        </label>
        <label>
          <LabelWithHelp
            label="End time"
            help="When monitoring ends for this commute window."
          />
          <input
            type="time"
            value={value.endTime}
            onChange={(e) => onChange({ ...value, endTime: e.target.value })}
          />
        </label>
        <label>
          <LabelWithHelp
            label="Commute threshold (minutes)"
            help="Absolute total trip-time trigger. Alert if live commute time reaches this number."
          />
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
          <LabelWithHelp
            label="Extra delay threshold (minutes)"
            help="Relative slowdown trigger. The app auto-calculates normal (baseline) time from Google each check, then compares live traffic time against it. Example: baseline 25, live 38 means extra delay 13."
          />
          <input
            type="number"
            min={0}
            value={value.minDelayMinutes}
            onChange={(e) => onChange({ ...value, minDelayMinutes: e.target.value })}
          />
        </label>
        <label>
          <LabelWithHelp
            label="Min rise since last check (minutes)"
            help="Minimum increase needed to consider traffic rising rapidly."
          />
          <input
            type="number"
            min={1}
            value={value.rapidIncreaseMinRiseMinutes}
            onChange={(e) => onChange({ ...value, rapidIncreaseMinRiseMinutes: e.target.value })}
          />
        </label>
        <label>
          <LabelWithHelp
            label="Lookahead (minutes)"
            help="How far ahead to project the current trend when deciding early warning."
          />
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
          Enable rapid-increase prediction <HelpTip text="If enabled, the app predicts if commute time is climbing fast and likely to cross your threshold soon." />
        </label>
      </div>
    </>
  );
}

function LabelWithHelp({ label, help }: { label: string; help: string }) {
  return (
    <span className="label-with-help">
      {label}
      <HelpTip text={help} />
    </span>
  );
}

function HelpTip({ text }: { text: string }) {
  return (
    <span className="help-tip" tabIndex={0} aria-label={`Help: ${text}`}>
      ?
      <span className="help-popup">{text}</span>
    </span>
  );
}
