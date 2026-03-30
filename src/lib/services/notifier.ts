export async function sendPushNotification(message: string): Promise<void> {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) {
    return;
  }

  const baseUrl = (process.env.NTFY_BASE_URL || "https://ntfy.sh").replace(/\/+$/, "");
  const token = process.env.NTFY_ACCESS_TOKEN;

  const res = await fetch(`${baseUrl}/${encodeURIComponent(topic)}`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      Title: "Commute Alert",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: message
  });

  if (!res.ok) {
    throw new Error(`ntfy publish failed (${res.status})`);
  }
}
