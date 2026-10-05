// Opt-in browser acceptance against a non-demo production server and real
// Supabase Auth. Admin-generated email tokens test redemption, not delivery.
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
import strictAssert from "node:assert/strict";
import Papa from "papaparse";
let assertions = 0;
const assert = new Proxy(strictAssert, {
  get(target, key) {
    const value = target[key];
    return typeof value === "function"
      ? (...args) => {
          const result = value(...args);
          assertions++;
          return result;
        }
      : value;
  },
});
const origin = process.env.NEXT_PUBLIC_APP_URL;
if (
  !["http://localhost:3000", "https://musicmail.vercel.app"].includes(origin) ||
  (origin.startsWith("https:") &&
    process.env.MUSICMAIL_LIVE_ACCEPTANCE !== "true")
)
  throw new Error(
    "Use the known local origin or explicitly opt into MusicMail production acceptance.",
  );
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const email = `musicmail-auth-${randomUUID()}@example.test`;
let password = `Mm1!${randomBytes(24).toString("base64url")}`,
  userId,
  step = "setup",
  browser;
function check(r) {
  if (r.error)
    throw new Error("Provider request failed", { cause: r.error.code });
  return r.data;
}
try {
  browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const cspErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /content security policy/i.test(m.text()))
      cspErrors.push(true);
  });
  async function challenge() {
    if (!(await page.locator('[aria-label="Security verification"]').count()))
      return undefined;
    await page.waitForFunction(
      () =>
        Boolean(
          document.querySelector('[name="cf-turnstile-response"]')?.value,
        ),
      null,
      { timeout: 60000 },
    );
    return page.locator('[name="cf-turnstile-response"]').inputValue();
  }
  const post = async (data) => {
    if (["login", "signup", "forgot", "resend"].includes(data.action)) {
      await page.goto(origin + "/login");
      const captchaToken = await challenge();
      if (captchaToken) data = { ...data, captchaToken };
    }
    return page.request.post(origin + "/api/auth", {
      headers: { Origin: origin },
      data,
    });
  };
  step = "protected route";
  await page.goto(origin + "/home");
  await page.waitForURL("**/login");
  assert.equal(
    (await page.request.get(origin + "/api/workspace")).status(),
    401,
  );
  step = "server password validation";
  assert.equal(
    (
      await post({
        action: "signup",
        name: "Test",
        email,
        password: "abcdefghij",
        confirmPassword: "abcdefghij",
      })
    ).status(),
    400,
  );
  assert.equal(
    (
      await post({
        action: "signup",
        name: "Test",
        email,
        password,
        confirmPassword: "mismatch",
      })
    ).status(),
    400,
  );
  step = "signup verification fixture";
  const signup = check(
    await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: { data: { name: "Auth acceptance test" } },
    }),
  );
  userId = signup.user.id;
  step = "unverified login denied";
  assert.equal(
    (await post({ action: "login", email, password })).status(),
    400,
  );
  step = "verify email via application";
  await page.goto(
    origin + "/verify-email#token_hash=" + signup.properties.hashed_token,
  );
  await page.getByRole("button", { name: "Verify email", exact: true }).click();
  await page.waitForURL("**/login?verified=1");
  step = "login browser form";
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await challenge();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/onboarding");
  step = "private profile provisioning";
  const doc = await (await page.request.get(origin + "/api/workspace")).json();
  assert.equal(doc.profile.display_name, "Auth acceptance test");
  step = "CRM creation and editing";
  const mutate = async (data) => {
    const response = await page.request.post(origin + "/api/workspace", {
      headers: { Origin: origin },
      data,
    });
    assert.equal(response.status(), 200);
    return response.json();
  };
  await mutate({
    action: "onboard",
    name: "Disposable smoke-test artist",
    type: "solo",
    location: "London",
    genres: ["Indie Folk"],
    emotions: [],
    goals: ["Find promoters"],
  });
  let crm = await mutate({
    action: "private",
    contact: {
      name: "Disposable private contact",
      email: "smoke@example.test",
      notes: "Initial private note",
    },
  });
  const contactId = crm.contacts.find(
    (c) => c.private_email === "smoke@example.test",
  ).id;
  await mutate({
    action: "update",
    id: contactId,
    patch: {
      relationship_status: "warm",
      outreach_status: "follow_up_needed",
      follow_up_at: "2026-10-10",
      private_display_name: "Edited smoke contact",
    },
  });
  await mutate({
    action: "note",
    id: contactId,
    body: "<script>window.musicmailXss=1</script>Private smoke note",
  });
  crm = await mutate({ action: "list", name: "Disposable smoke list" });
  const listId = crm.lists.find((l) => l.name === "Disposable smoke list").id;
  await mutate({ action: "member", listId, contactIds: [contactId] });
  await mutate({
    action: "view",
    name: "Disposable smoke view",
    filters: { relationship: "warm" },
  });
  step = "authenticated calendar and appearance";
  const calendarPost = async (data) => {
    const r = await page.request.post(origin + "/api/calendar", {
      headers: { Origin: origin },
      data,
    });
    assert.equal(r.status(), 200);
    return r.json();
  };
  const calendarInput = {
    title: "Disposable hosted calendar gig",
    date: "2026-10-12",
    start_time: "19:30",
    end_time: "22:00",
    timezone: "Europe/London",
    location_name: "Fictional room",
    contact_id: contactId,
    artist_entity_id: crm.artist.id,
    load_in_time: "17:30",
    items: [{ label: "Martin D-28" }, { label: "mics", quantity: 2 }],
  };
  step = "calendar create response";
  let calendarSaved = (
    await calendarPost({ action: "save", event: calendarInput })
  ).event;
  assert.equal(calendarSaved.workspace_id, userId);
  assert.equal(calendarSaved.items.length, 2);
  assert.equal(calendarSaved.starts_at, "2026-10-12T18:30:00+00:00");
  step = "calendar checklist update";
  calendarSaved = (
    await calendarPost({
      action: "check",
      id: calendarSaved.id,
      itemId: calendarSaved.items[0].id,
      completed: true,
    })
  ).event;
  assert.equal(calendarSaved.items[0].completed, true);
  step = "calendar edit";
  calendarSaved = (
    await calendarPost({
      action: "save",
      id: calendarSaved.id,
      event: {
        ...calendarInput,
        title: "Edited hosted calendar gig",
        items: calendarSaved.items.map((i) => ({
          id: i.id,
          label: i.label,
          quantity: i.quantity,
          completed: i.completed,
        })),
      },
    })
  ).event;
  assert.equal(calendarSaved.title, "Edited hosted calendar gig");
  assert.equal(calendarSaved.items[0].completed, true);
  step = "calendar ICS";
  const ics = await page.request.get(
    origin + `/api/calendar/${calendarSaved.id}/export`,
  );
  assert.equal(ics.status(), 200);
  assert.ok((await ics.text()).includes("DTSTART:20261012T183000Z"));
  assert.equal(ics.headers()["cache-control"], "private, no-store");
  assert.equal(
    (
      await page.request.post(origin + "/api/calendar", {
        data: { action: "delete", id: calendarSaved.id },
      })
    ).status(),
    400,
  );
  step = "appearance persistence";
  await page.goto(origin + "/settings");
  await page.getByRole("radio", { name: "Dark", exact: true }).check();
  await page.getByRole("radio", { name: "Dark", exact: true }).waitFor();
  await page.waitForFunction(
    () => !document.querySelector('input[value="dark"]').disabled,
  );
  await page.reload();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  assert.equal(
    check(
      await admin.from("profiles").select("theme").eq("id", userId).single(),
    ).theme,
    "dark",
  );
  assert.equal(
    (
      await page.request.post(origin + "/api/appearance", {
        data: { theme: "light" },
      })
    ).status(),
    400,
  );
  step = "large calendar export fixture";
  // Exceed the provider's default 1,000-row cap to verify complete exports.
  const volume = Array.from({ length: 1001 }, (_, i) => ({
    workspace_id: userId,
    user_id: userId,
    title: `Disposable volume calendar ${i}`,
    start_date: "2026-10-13",
    end_date: "2026-10-14",
  }));
  for (let offset = 0; offset < volume.length; offset += 100)
    check(
      await admin
        .from("calendar_events")
        .insert(volume.slice(offset, offset + 100)),
    );
  step = "CSV import and complete private export";
  const imported = Papa.parse(
    "name,email,notes\nImported smoke,imported@example.test,Import note",
    { header: true },
  ).data;
  const preview = await page.request.post(origin + "/api/import/preview", {
    headers: { Origin: origin },
    data: {
      contacts: imported,
    },
  });
  assert.equal(preview.status(), 200);
  assert.deepEqual((await preview.json()).duplicates, []);
  await mutate({
    action: "import",
    contacts: imported,
    confirmDuplicates: false,
  });
  const exportResponse = await page.request.get(
    origin + "/api/export?format=json",
  );
  assert.equal(exportResponse.status(), 200);
  const exported = await exportResponse.json();
  assert.equal(exported.contacts.length, 2);
  assert.equal(
    exported.calendarEvents.length,
    1002,
    "Calendar full export truncated",
  );
  assert.equal(
    exported.calendarEvents.find((e) => e.id === calendarSaved.id).items.length,
    2,
  );
  assert.equal(exported.profile.theme, "dark");
  assert.ok(exported.contacts.some((c) => c.follow_up_at === "2026-10-10"));
  assert.ok(exported.notes.some((n) => n.body.includes("Private smoke note")));
  assert.ok(
    exported.members.some(
      (m) => m.list_id === listId && m.user_contact_id === contactId,
    ),
  );
  assert.ok(exported.interactions.length >= 4);
  assert.ok(exported.views.some((v) => v.name === "Disposable smoke view"));
  assert.ok(
    !/access_token|refresh_token|encrypted_tokens|service_role|password/.test(
      JSON.stringify(exported),
    ),
  );
  const csv = await page.request.get(origin + "/api/export");
  assert.equal(csv.status(), 200);
  assert.ok((await csv.text()).includes("Edited smoke contact"));
  step = "rendered private text and request integrity";
  await page.goto(origin + "/network");
  await page
    .getByRole("button", { name: "Edited smoke contact", exact: true })
    .click();
  await page
    .getByText("<script>window.musicmailXss=1</script>Private smoke note", {
      exact: true,
    })
    .waitFor({ state: "visible" });
  assert.ok(
    await page
      .getByText("<script>window.musicmailXss=1</script>Private smoke note", {
        exact: true,
      })
      .isVisible(),
  );
  assert.equal(await page.evaluate(() => window.musicmailXss), undefined);
  assert.equal(
    (
      await page.request.post(origin + "/api/workspace", {
        headers: { Origin: "https://malicious.example" },
        data: { action: "list", name: "Forbidden" },
      })
    ).status(),
    400,
  );
  assert.equal(
    (
      await page.request.post(origin + "/api/admin", {
        headers: { Origin: origin },
        data: { action: "archive", id: contactId },
      })
    ).status(),
    400,
  );
  step = "Gmail permission boundary";
  const connection = await page.request.get(origin + "/api/gmail/connect", {
    maxRedirects: 0,
  });
  if (process.env.MUSICMAIL_EXPECT_GMAIL === "true") {
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
  } else {
    assert.equal(connection.status(), 400);
    console.log(
      "Gmail production credentials are not configured; connect gate remains blocked.",
    );
  }
  const gmailCallback = await page.request.get(
    origin + "/api/gmail/callback?state=invalid&code=invalid",
    { maxRedirects: 0 },
  );
  assert.equal(
    gmailCallback.headers().location,
    origin + "/settings?gmail=failed",
  );
  assert.equal(
    (
      await page.request.post(origin + "/api/gmail/disconnect", {
        headers: { Origin: origin },
        data: {},
      })
    ).status(),
    200,
  );
  step = "session cookie boundary";
  const cookies = await context.cookies();
  const authCookies = cookies.filter((c) => c.name.includes("auth-token"));
  assert.ok(authCookies.length > 0);
  assert.ok(authCookies.every((c) => c.httpOnly && c.sameSite === "Lax"));
  if (origin.startsWith("https:"))
    assert.ok(authCookies.every((c) => c.secure));
  assert.ok(
    !(await page.evaluate(() =>
      Object.keys(localStorage).some((k) => /auth|token/i.test(k)),
    )),
  );
  step = "forged session rejected";
  const forged = await browser.newContext();
  await forged.addCookies(
    authCookies.map((c) => ({ ...c, value: "not-a-valid-session" })),
  );
  assert.equal(
    (await forged.request.get(origin + "/api/workspace")).status(),
    401,
  );
  await forged.close();
  step = "fixed callback redirect";
  const callback = await page.request.get(
    origin +
      "/auth/callback?code=invalid-test-code&redirect=https://malicious.example",
    { maxRedirects: 0 },
  );
  assert.ok(callback.headers().location.startsWith(origin + "/login"));
  step = "logout protection";
  assert.equal((await post({ action: "logout" })).status(), 200);
  assert.equal(
    (await page.request.get(origin + "/api/workspace")).status(),
    401,
  );
  step = "invalid recovery";
  assert.equal(
    (
      await post({
        action: "reset",
        tokenHash: "a".repeat(64),
        password,
        confirmPassword: password,
      })
    ).status(),
    400,
  );
  step = "recovery redemption";
  const recovery = check(
    await admin.auth.admin.generateLink({ type: "recovery", email }),
  );
  const newPassword = `Mm2!${randomBytes(24).toString("base64url")}`;
  await page.goto(
    origin + "/reset-password#token_hash=" + recovery.properties.hashed_token,
  );
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm password", { exact: true }).fill(newPassword);
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await page.waitForURL("**/login?reset=1");
  step = "single-use recovery";
  assert.equal(
    (
      await post({
        action: "reset",
        tokenHash: recovery.properties.hashed_token,
        password,
        confirmPassword: password,
      })
    ).status(),
    400,
  );
  step = "new password login";
  assert.equal(
    (await post({ action: "login", email, password })).status(),
    400,
  );
  password = newPassword;
  assert.equal(
    (await post({ action: "login", email, password })).status(),
    200,
  );
  step = "secure password change";
  await page.goto(origin + "/change-password");
  await page.getByLabel("Current password", { exact: true }).fill(password);
  const changed = `Mm3!${randomBytes(24).toString("base64url")}`;
  await page.getByLabel("New password", { exact: true }).fill(changed);
  await page.getByLabel("Confirm password", { exact: true }).fill(changed);
  await challenge();
  await page
    .getByRole("button", { name: "Change password", exact: true })
    .click();
  await page.waitForURL("**/login?changed=1");
  step = "changed password login";
  assert.equal(
    (await post({ action: "login", email, password: changed })).status(),
    200,
  );
  step = "CSP and content type";
  const response = await page.request.get(origin + "/login");
  assert.ok(
    response.headers()["content-security-policy"].includes("'strict-dynamic'"),
  );
  assert.equal(response.headers()["x-content-type-options"], "nosniff");
  assert.equal(cspErrors.length, 0);
  step = "authenticated account deletion";
  const deletion = await page.request.delete(origin + "/api/account", {
    headers: { Origin: origin },
    data: { confirmation: "DELETE" },
  });
  assert.equal(deletion.status(), 200);
  assert.ok(
    (await admin.auth.admin.getUserById(userId)).error,
    "Deleted Auth user still exists",
  );
  const deletedUserId = userId;
  userId = null;
  for (const table of [
    "workspaces",
    "profiles",
    "user_contacts",
    "notes",
    "lists",
    "list_members",
    "saved_views",
    "interactions",
    "sent_emails",
    "calendar_events",
    "calendar_event_items",
  ]) {
    const ownerColumn = ["workspaces", "profiles"].includes(table)
      ? "id"
      : "workspace_id";
    const result = await admin
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq(ownerColumn, deletedUserId);
    assert.equal(result.error, null);
    assert.equal(result.count, 0, "Deleted private fixture remains");
  }
  console.log(
    `Hosted browser Auth/CRM/Calendar passed (${assertions} assertions): protected routes, signup token verification, login, cookies, contact create/edit, notes/XSS, lists/members, views, CSV import/full JSON+CSV export, calendar CRUD/checklists/ICS, 1,002-event complete export, persisted appearance, request integrity, Gmail callback/disconnect boundary, logout, recovery single use/old password rejection, password change, CSP and recent-auth deletion/cleanup. SMTP delivery and real Gmail consent/send remain separate evidence.`,
  );
} catch (error) {
  console.error("Hosted Auth acceptance failed at: " + step);
  const frame = String(error.stack || "")
    .split("\n")
    .find((line) => line.includes("test-hosted-auth.mjs:"));
  if (frame) console.error(error.name + " " + frame.trim());
  if (
    typeof error.cause === "string" &&
    /^[A-Za-z0-9_]{1,20}$/.test(error.cause)
  )
    console.error("Provider error code: " + error.cause);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (userId) {
    const r = await admin.auth.admin.deleteUser(userId);
    if (r.error) {
      console.error("Auth test cleanup failed.");
      process.exitCode = 1;
    } else console.log("Disposable Auth fixture removed.");
  }
}
