// Test one-time email proof handling, not SMTP delivery or CAPTCHA login.
// Admin credentials create disposable proofs only; application calls use their
// own cookie context. Never write passwords, tokens or cookie state to disk.
import { request } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import assert from "node:assert/strict";

const origin = process.env.NEXT_PUBLIC_APP_URL;
assert.ok(
  origin === "https://app.musicmailapp.uk" &&
    process.env.MUSICMAIL_LIVE_ACCEPTANCE === "true",
  "Explicitly opt into the canonical MusicMail acceptance origin.",
);
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const email = `musicmail-email-proof-${randomUUID()}@example.test`;
const password = () => `Mm1!${randomBytes(24).toString("base64url")}`;
let uid,
  context,
  step = "setup";
function provider(result) {
  if (result.error) throw new Error("Provider request failed");
  return result.data;
}
try {
  context = await request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
    timeout: 20000,
  });
  const post = (data, headers) =>
    context.post("/api/auth", { data, ...(headers ? { headers } : {}) });
  step = "signup proof fixture";
  const signup = provider(
    await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password: password(),
      options: { redirectTo: origin + "/verify-email" },
    }),
  );
  uid = signup.user.id;
  assert.equal(signup.user.email_confirmed_at, undefined);
  assert.equal(
    new URL(signup.properties.action_link).searchParams.get("redirect_to"),
    origin + "/verify-email",
  );
  step = "confirmation prefetch and purpose binding";
  assert.equal((await context.get("/verify-email")).status(), 200);
  assert.equal((await context.head("/verify-email")).status(), 200);
  assert.equal((await context.get("/api/workspace")).status(), 401);
  assert.ok(
    !provider(await admin.auth.admin.getUserById(uid)).user.email_confirmed_at,
  );
  const signupToken = signup.properties.hashed_token;
  const changed = password();
  assert.equal(
    (
      await post({
        action: "reset",
        tokenHash: signupToken,
        password: changed,
        confirmPassword: changed,
      })
    ).status(),
    400,
  );
  step = "explicit confirmation and session cookies";
  const confirmed = await post({ action: "verify", tokenHash: signupToken });
  assert.equal(confirmed.status(), 200);
  assert.equal((await confirmed.json()).url, "/login?verified=1");
  assert.ok(
    provider(await admin.auth.admin.getUserById(uid)).user.email_confirmed_at,
  );
  assert.equal((await context.get("/api/workspace")).status(), 200);
  const cookies = (await context.storageState()).cookies.filter((c) =>
    c.name.startsWith("sb-"),
  );
  assert.ok(cookies.length > 0);
  for (const cookie of cookies) {
    assert.equal(cookie.domain, "app.musicmailapp.uk");
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.secure, true);
    assert.equal(cookie.sameSite, "Lax");
  }
  step = "owned-origin Gmail initiation boundaries";
  const connection = await context.get("/api/gmail/connect", {
    maxRedirects: 0,
  });
  assert.equal(connection.status(), 307);
  const consent = new URL(connection.headers().location);
  assert.equal(consent.origin, "https://accounts.google.com");
  assert.equal(
    consent.searchParams.get("redirect_uri"),
    origin + "/api/gmail/callback",
  );
  assert.equal(
    consent.searchParams.get("scope"),
    "openid email https://www.googleapis.com/auth/gmail.send",
  );
  assert.equal(consent.searchParams.get("code_challenge_method"), "S256");
  const oauthCookie = (await context.storageState()).cookies.find(
    (c) => c.name === "musicmail-oauth",
  );
  assert.ok(oauthCookie);
  assert.equal(oauthCookie.domain, "app.musicmailapp.uk");
  assert.equal(oauthCookie.httpOnly, true);
  assert.equal(oauthCookie.secure, true);
  assert.equal(oauthCookie.sameSite, "Lax");
  assert.equal(oauthCookie.path, "/api/gmail");
  const saved = JSON.parse(decodeURIComponent(oauthCookie.value));
  assert.equal(saved.userId, uid);
  assert.equal(saved.state, consent.searchParams.get("state"));
  assert.ok(saved.state.length >= 32);
  assert.equal(
    consent.searchParams.get("code_challenge"),
    createHash("sha256").update(saved.verifier).digest("base64url"),
  );
  const remaining = saved.expires - Date.parse(connection.headers().date);
  assert.ok(remaining >= 599000 && remaining <= 601000);
  assert.match(
    connection
      .headersArray()
      .find(
        (h) =>
          h.name.toLowerCase() === "set-cookie" &&
          h.value.startsWith("musicmail-oauth="),
      )?.value || "",
    /;\s*Max-Age=600(?:;|$)/i,
  );
  const invalidCallback = await context.get(
    "/api/gmail/callback?state=invalid&code=invalid",
    { maxRedirects: 0 },
  );
  assert.equal(invalidCallback.status(), 307);
  assert.equal(
    invalidCallback.headers().location,
    origin + "/settings?gmail=failed",
  );
  assert.ok(
    !(await context.storageState()).cookies.some(
      (c) => c.name === "musicmail-oauth",
    ),
  );
  assert.equal(
    (await post({ action: "verify", tokenHash: signupToken })).status(),
    400,
  );
  assert.equal(
    (
      await post({
        action: "reset",
        password: changed,
        confirmPassword: changed,
      })
    ).status(),
    403,
  );
  assert.equal((await post({ action: "logout" })).status(), 200);
  assert.equal((await context.get("/api/workspace")).status(), 401);
  step = "recovery proof fixture";
  const recovery = provider(
    await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: origin + "/reset-password" },
    }),
  );
  assert.equal(
    new URL(recovery.properties.action_link).searchParams.get("redirect_to"),
    origin + "/reset-password",
  );
  const tokenHash = recovery.properties.hashed_token;
  step = "recovery prefetch, origin, purpose and password policy";
  assert.equal((await context.get("/reset-password")).status(), 200);
  assert.equal((await context.head("/reset-password")).status(), 200);
  assert.equal((await post({ action: "verify", tokenHash })).status(), 400);
  const stale = await post(
    { action: "reset", tokenHash, password: changed, confirmPassword: changed },
    { Origin: "https://musicmail.vercel.app" },
  );
  assert.equal(stale.status(), 400);
  assert.equal(
    (await stale.json()).error,
    "Request origin could not be verified.",
  );
  const weak = await post({
    action: "reset",
    tokenHash,
    password: "abcdefghij",
    confirmPassword: "abcdefghij",
  });
  assert.equal(weak.status(), 400);
  assert.match((await weak.json()).error, /Password must contain/);
  assert.equal(
    (
      await post({
        action: "reset",
        tokenHash,
        password: changed,
        confirmPassword: "mismatch",
      })
    ).status(),
    400,
  );
  step = "explicit recovery and replay rejection";
  const reset = await post({
    action: "reset",
    tokenHash,
    password: changed,
    confirmPassword: changed,
  });
  assert.equal(reset.status(), 200);
  assert.equal((await reset.json()).url, "/login?reset=1");
  assert.equal((await context.get("/api/workspace")).status(), 401);
  assert.equal(
    (
      await post({
        action: "reset",
        tokenHash,
        password: changed,
        confirmPassword: changed,
      })
    ).status(),
    400,
  );
  console.log(
    "Owned-origin email proofs and Gmail initiation passed: GET/HEAD do not consume, explicit confirmation/recovery, purpose and Origin binding, password validation, secure cookies, replay rejection, reset logout, exact send-only callback/PKCE/state/expiry and invalid-callback rejection. No mail sent or Google consent followed; CAPTCHA login/delivery remain separate checks.",
  );
} catch {
  console.error("Hosted email-proof acceptance failed at: " + step);
  process.exitCode = 1;
} finally {
  if (context) await context.dispose();
  if (uid) {
    const result = await admin.auth.admin.deleteUser(uid);
    if (result.error) {
      console.error("Disposable email-proof cleanup failed.");
      process.exitCode = 1;
    } else console.log("Disposable email-proof fixture removed.");
  }
}
