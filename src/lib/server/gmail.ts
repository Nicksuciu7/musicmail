import "server-only";
import { z } from "zod";
import { encrypt, decrypt } from "./crypto";
import { checked, serviceClient, identity } from "./supabase";
import { workspace } from "./repository";
import { contactEmail } from "../domain";
type Tokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};
export const gmailConfig = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID,
    clientSecret = process.env.GOOGLE_CLIENT_SECRET,
    appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!clientId || !clientSecret || !appUrl)
    throw new Error("Google OAuth is not configured. See docs/deployment.md.");
  return {
    clientId,
    clientSecret,
    callback: new URL("/api/gmail/callback", appUrl).toString(),
  };
};
async function googleToken(params: Record<string, string>) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(
      "Gmail authorisation expired or failed. Please reconnect Gmail.",
    );
  return z
    .object({
      access_token: z.string(),
      refresh_token: z.string().optional(),
      expires_in: z.number(),
      scope: z.string().optional(),
    })
    .parse(await response.json());
}
export async function exchangeCode(
  userId: string,
  code: string,
  verifier: string,
) {
  const c = gmailConfig();
  const tokens = await googleToken({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    redirect_uri: c.callback,
    code,
    code_verifier: verifier,
    grant_type: "authorization_code",
  });
  if (
    !tokens.scope
      ?.split(" ")
      .includes("https://www.googleapis.com/auth/gmail.send")
  )
    throw new Error("Gmail send permission was not granted.");
  const response = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok)
    throw new Error("Could not verify the connected Gmail identity.");
  const profile = z
    .object({ email: z.email(), email_verified: z.boolean() })
    .parse(await response.json());
  if (!profile.email_verified)
    throw new Error("The Google email is not verified.");
  const db = serviceClient();
  const old = checked(
    await db
      .from("gmail_connections")
      .select("encrypted_tokens,email")
      .eq("user_id", userId)
      .maybeSingle(),
  );
  const refresh =
    tokens.refresh_token ||
    (old && old.email === profile.email
      ? decrypt<Tokens>(old.encrypted_tokens).refresh_token
      : "");
  if (!refresh)
    throw new Error(
      "No refresh token was returned. Revoke MusicMail in Google settings and reconnect.",
    );
  checked(
    await db.from("gmail_connections").upsert({
      user_id: userId,
      email: profile.email,
      encrypted_tokens: encrypt({
        access_token: tokens.access_token,
        refresh_token: refresh,
        expires_at: Date.now() + tokens.expires_in * 1000,
      }),
    }),
  );
}
async function accessToken(userId: string) {
  const db = serviceClient();
  const row = checked(
    await db
      .from("gmail_connections")
      .select("*")
      .eq("user_id", userId)
      .single(),
  );
  let tokens = decrypt<Tokens>(row.encrypted_tokens);
  if (tokens.expires_at < Date.now() + 60000) {
    const c = gmailConfig();
    const refreshed = await googleToken({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    });
    tokens = {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token || tokens.refresh_token,
      expires_at: Date.now() + refreshed.expires_in * 1000,
    };
    checked(
      await db
        .from("gmail_connections")
        .update({
          encrypted_tokens: encrypt(tokens),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId),
    );
  }
  return tokens.access_token;
}
export async function disconnect(userId: string) {
  const db = serviceClient();
  const row = checked(
    await db
      .from("gmail_connections")
      .select("encrypted_tokens")
      .eq("user_id", userId)
      .maybeSingle(),
  );
  let revoked = true;
  if (row) {
    try {
      const tokens = decrypt<Tokens>(row.encrypted_tokens);
      const r = await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: tokens.refresh_token }),
        signal: AbortSignal.timeout(10000),
      });
      revoked = r.ok;
    } catch {
      revoked = false;
    }
  }
  checked(await db.from("gmail_connections").delete().eq("user_id", userId));
  return revoked;
}
export const sendSchema = z.object({
  messages: z
    .array(
      z.object({
        attemptId: z.uuid(),
        contactId: z.uuid(),
        subject: z
          .string()
          .trim()
          .min(1)
          .max(300)
          .refine((s) => !/[\r\n]/.test(s)),
        body: z.string().trim().min(1).max(30000),
      }),
    )
    .min(1)
    .max(10),
  confirmed: z.literal(true),
});
export function mimeMessage(recipient: string, subject: string, body: string) {
  z.email().parse(recipient);
  if (/[\r\n]/.test(subject)) throw new Error("Invalid subject.");
  return Buffer.from(
    `To: ${recipient}\r\nSubject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${
      Buffer.from(body)
        .toString("base64")
        .match(/.{1,76}/g)
        ?.join("\r\n") || ""
    }`,
  ).toString("base64url");
}
export async function sendMessages(input: z.infer<typeof sendSchema>) {
  const user = await identity();
  if (user.demo)
    throw new Error("Demo mode previews messages only. No email was sent.");
  const w = await workspace(
    false,
    input.messages.map((m) => m.contactId),
  );
  if (!w.gmailEmail) throw new Error("Connect Gmail in Settings first.");
  if (
    new Set(input.messages.map((m) => m.contactId)).size !==
    input.messages.length
  )
    throw new Error("Each contact may only appear once.");
  const db = serviceClient();
  const results: { contactId: string; status: string; message: string }[] = [];
  for (const m of input.messages) {
    const c = w.contacts.find((c) => c.id === m.contactId && !c.archived);
    if (!c || c.outreach_status === "do_not_contact") {
      results.push({
        contactId: m.contactId,
        status: "failed",
        message: "Contact unavailable or marked do not contact.",
      });
      continue;
    }
    const recipient = z.email().parse(contactEmail(c));
    if (recipient.endsWith(".example")) {
      results.push({
        contactId: m.contactId,
        status: "failed",
        message: "Synthetic .example contacts cannot receive email.",
      });
      continue;
    }
    const reservation = await db.rpc("reserve_email", {
      attempt_id: m.attemptId,
      owner_id: user.id,
      contact_id: c.id,
    });
    if (reservation.error) {
      results.push({
        contactId: c.id,
        status: "failed",
        message:
          "Send already attempted, contact suppressed, or hourly limit reached.",
      });
      continue;
    }
    let submitted = false;
    try {
      const token = await accessToken(user.id);
      const latest = checked(
        await db
          .from("user_contacts")
          .select("outreach_status,archived")
          .eq("id", c.id)
          .eq("user_id", user.id)
          .single(),
      );
      if (latest.archived || latest.outreach_status === "do_not_contact")
        throw new Error("Contact is suppressed.");
      submitted = true;
      const response = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            raw: mimeMessage(recipient, m.subject, m.body),
          }),
          signal: AbortSignal.timeout(20000),
        },
      );
      if (!response.ok) {
        submitted = response.status >= 500;
        throw new Error(
          "Gmail rejected this message. Check your connection and sending quota.",
        );
      }
      const message = z.object({ id: z.string() }).parse(await response.json());
      checked(
        await db.rpc("record_sent", {
          attempt_id: m.attemptId,
          owner_id: user.id,
          contact_id: c.id,
          message_id: message.id,
          to_email: recipient,
          message_subject: m.subject,
          message_body: m.body,
        }),
      );
      results.push({
        contactId: c.id,
        status: "sent",
        message: "Sent successfully.",
      });
    } catch {
      await db
        .from("email_send_attempts")
        .update({ status: submitted ? "uncertain" : "failed" })
        .eq("id", m.attemptId);
      console.error(
        JSON.stringify({
          event: "email_send_failure",
          category: submitted ? "uncertain_delivery" : "provider_failure",
        }),
      );
      results.push({
        contactId: c.id,
        status: submitted ? "uncertain" : "failed",
        message: submitted
          ? "Delivery is uncertain. Check Gmail Sent before sending again."
          : "Message was not sent. Reconnect Gmail or check your sending quota.",
      });
    }
  }
  return { results };
}
