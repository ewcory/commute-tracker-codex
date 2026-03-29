import twilio from "twilio";

export async function sendSmsIfEnabled(phoneNumber: string | null, message: string): Promise<void> {
  if (!phoneNumber) {
    return;
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_FROM_PHONE;

  if (!sid || !authToken || !fromPhone) {
    return;
  }

  const client = twilio(sid, authToken);
  await client.messages.create({
    to: phoneNumber,
    from: fromPhone,
    body: message
  });
}

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
