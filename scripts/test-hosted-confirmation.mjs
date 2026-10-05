// Opt-in email confirmation acceptance against MusicMail's exact deployed origin.
// Admin-generated tokens exercise redemption without sending email or changing real accounts.
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
const origin =
  process.env.TEST_CONFIRMATION_ORIGIN || "https://musicmail.vercel.app";
if (!["https://musicmail.vercel.app", "http://localhost:3000"].includes(origin))
  throw new Error(
    "Use the MusicMail production origin or configured local acceptance origin.",
  );
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
let id,
  browser,
  step = "fixture";
try {
  const fixture = await db.auth.admin.generateLink({
    type: "signup",
    email: `musicmail-confirm-${randomUUID()}@example.test`,
    password: `Mm1!${randomBytes(24).toString("base64url")}`,
  });
  if (fixture.error) throw new Error("Fixture creation failed");
  id = fixture.data.user.id;
  const token = fixture.data.properties.hashed_token;
  const link = `${origin}/verify-email#token_hash=${token}`;
  browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  let posts = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url() === origin + "/api/auth") posts++;
  });
  step = "prefetch";
  assert.equal(
    (await context.request.head(origin + "/verify-email")).status(),
    200,
  );
  assert.equal(
    (await context.request.get(origin + "/verify-email")).status(),
    200,
  );
  await page.goto(link);
  await page
    .getByRole("button", { name: "Verify email", exact: true })
    .waitFor();
  await page.waitForFunction(() => !location.hash);
  assert.equal(posts, 0, "Opening the page must not redeem a token");
  const before = await db.auth.admin.getUserById(id);
  assert.equal(Boolean(before.data.user.email_confirmed_at), false);
  step = "explicit confirmation";
  const accepted = page.waitForResponse(
    (r) => r.url() === origin + "/api/auth" && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Verify email", exact: true }).click();
  assert.equal((await accepted).status(), 200);
  await page.waitForURL("**/login?verified=1");
  assert.equal(posts, 1);
  const after = await db.auth.admin.getUserById(id);
  assert.ok(after.data.user.email_confirmed_at);
  const authCookies = (await context.cookies()).filter((c) =>
    c.name.includes("auth-token"),
  );
  step = "session cookie boundary";
  assert.ok(
    authCookies.length > 0 &&
      authCookies.every(
        (c) =>
          c.secure === origin.startsWith("https:") &&
          c.httpOnly &&
          c.sameSite === "Lax",
      ),
  );
  step = "single use";
  const other = await browser.newContext();
  const replay = await other.newPage();
  await replay.goto(link);
  await replay
    .getByRole("button", { name: "Verify email", exact: true })
    .waitFor();
  const rejected = replay.waitForResponse(
    (r) => r.url() === origin + "/api/auth" && r.request().method() === "POST",
  );
  await replay
    .getByRole("button", { name: "Verify email", exact: true })
    .click();
  assert.equal((await rejected).status(), 400);
  step = "provider PKCE format";
  const r = await other.request.post(origin + "/api/auth", {
    headers: { Origin: origin },
    data: {
      action: "verify",
      tokenHash: "pkce_" + randomBytes(28).toString("hex"),
    },
  });
  assert.equal(r.status(), 400);
  assert.match((await r.json()).error, /invalid or expired/);
  console.log(
    "Confirmation acceptance passed: GET/HEAD and opening page do not redeem; explicit click verifies; reuse rejected; cookies secure; PKCE format reaches provider. No emails sent.",
  );
} catch (error) {
  console.error(
    "Confirmation acceptance failed at step: " + step + " (" + error.name + ")",
  );
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (id) {
    const result = await db.auth.admin.deleteUser(id);
    if (result.error) {
      console.error("Fixture cleanup failed");
      process.exitCode = 1;
    } else console.log("Disposable confirmation fixture removed.");
  }
}
