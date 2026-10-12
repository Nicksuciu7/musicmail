// Negative live enforcement test: never sends email or creates accounts.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
const fixtureId = randomUUID();
const origin =
  process.env.MUSICMAIL_CAPTCHA_ORIGIN || "https://app.musicmailapp.uk";
assert.ok(
  ["https://musicmail.vercel.app", "https://app.musicmailapp.uk"].includes(
    origin,
  ),
  "Use only a verified MusicMail production origin",
);
const auth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const result = await auth.auth.signInWithPassword({
  email: `musicmail-captcha-provider-${fixtureId}@example.test`,
  password: "Invalid1!synthetic",
  options: { captchaToken: "invalid-synthetic-challenge" },
});
assert.equal(
  result.error?.code,
  "captcha_failed",
  "Supabase server-side CAPTCHA is not enforcing invalid tokens",
);
const html = await (await fetch(origin + "/signup")).text();
assert.ok(
  html.includes("Security verification"),
  "Production public widget key is missing",
);
for (const action of ["signup", "forgot", "resend", "login"]) {
  const input = {
    action,
    name: "Negative test",
    email: `musicmail-captcha-${action}-${fixtureId}@example.test`,
    password: "Invalid1!synthetic",
    confirmPassword: "Invalid1!synthetic",
  };
  const response = await fetch(origin + "/api/auth", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /verification challenge/i);
}
const invalidRecovery = await fetch(origin + "/api/auth", {
  method: "POST",
  headers: { Origin: origin, "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "forgot",
    email: `musicmail-captcha-recovery-${fixtureId}@example.test`,
    captchaToken: "invalid-synthetic-challenge",
  }),
  signal: AbortSignal.timeout(20000),
});
assert.equal(invalidRecovery.status, 400);
assert.match((await invalidRecovery.json()).error, /verification failed/i);
console.log(
  "Production CAPTCHA: server rejects invalid token, widget rendered, all four public flows reject missing tokens, recovery rejects invalid token. No mail sent. Successful real-widget acceptance is covered separately by hosted Auth browser smoke.",
);
