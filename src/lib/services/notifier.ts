import twilio from "twilio";
import webpush from "web-push";

import { deletePushSubscription, listPushSubscriptions } from "@/lib/store";

function configureWebPush(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const contact = process.env.VAPID_CONTACT_EMAIL;
  if (!publicKey || !privateKey || !contact) {
    return false;
  }

  webpush.setVapidDetails(`mailto:${contact}`, publicKey, privateKey);
  return true;
}

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
  if (!configureWebPush()) {
    return;
  }

  const subs = await listPushSubscriptions();
  if (subs.length === 0) {
    return;
  }

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          JSON.stringify({
            title: "Commute Alert",
            body: message
          })
        );
      } catch {
        await deletePushSubscription(sub.endpoint).catch(() => undefined);
      }
    })
  );
}
