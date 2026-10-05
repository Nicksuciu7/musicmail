// Disposable real Auth/JWT/browser tests. Never send email, print credentials,
// promote a real customer, or use the service key in a browser.
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import strictAssert from "node:assert/strict";
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
if (origin !== "http://localhost:3000")
  throw new Error(
    "Administrator acceptance requires the local non-demo server.",
  );
const options = {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (u, o) => fetch(u, { ...o, signal: AbortSignal.timeout(20000) }),
  },
};
const trusted = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  options,
);
const fixtures = [];
const entityId = randomUUID();
const taxonomyName = "Disposable admin acceptance " + randomUUID();
let browser,
  taxonomyId,
  step = "setup";
function checked(result) {
  if (result.error)
    throw new Error("Provider operation failed", { cause: result.error.code });
  return result.data;
}
function safePayload(value) {
  const forbidden = new Set([
    "encrypted_password",
    "password",
    "encrypted_tokens",
    "access_token",
    "refresh_token",
    "provider_token",
    "provider_refresh_token",
    "raw_user_meta_data",
    "raw_app_meta_data",
    "confirmation_token",
    "recovery_token",
    "service_role_key",
    "session",
    "gmail_message_id",
  ]);
  function walk(v) {
    if (!v || typeof v !== "object") return;
    for (const [key, item] of Object.entries(v)) {
      assert.ok(
        !forbidden.has(key),
        "Privileged response contains a credential/provider field",
      );
      walk(item);
    }
  }
  walk(value);
  const text = JSON.stringify(value);
  for (const name of [
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_DB_URL",
    "APP_ENCRYPTION_KEY",
    "GOOGLE_CLIENT_SECRET",
  ])
    if (process.env[name])
      assert.ok(
        !text.includes(process.env[name]),
        "Server secret exposed in response",
      );
}
try {
  step = "disposable fixture setup";
  browser = await chromium.launch();
  for (const label of ["a", "b", "admin"]) {
    const email = `musicmail-admin-${label}-${randomUUID()}@example.test`;
    const password = `Mm1!${randomBytes(24).toString("base64url")}`;
    const { user } = checked(
      await trusted.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: "admin",
          is_admin: true,
          name: "Disposable admin security test",
        },
      }),
    );
    const fixture = { id: user.id, email, password };
    fixtures.push(fixture);
    fixture.db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      options,
    );
    const proof = checked(
      await trusted.auth.admin.generateLink({ type: "magiclink", email }),
    );
    checked(
      await fixture.db.auth.verifyOtp({
        type: "magiclink",
        token_hash: proof.properties.hashed_token,
      }),
    );
    assert.equal(
      checked(await fixture.db.rpc("is_admin")),
      false,
      "Client metadata promoted a new member",
    );
    assert.equal(
      checked(
        await trusted
          .from("user_roles")
          .select("role")
          .eq("user_id", fixture.id)
          .single(),
      ).role,
      "member",
    );
    fixture.context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    fixture.page = await fixture.context.newPage();
    await fixture.page.goto(origin + "/login");
    assert.equal(
      (
        await fixture.page.request.post(origin + "/api/auth", {
          headers: { Origin: origin },
          data: { action: "login", email, password },
        })
      ).status(),
      200,
    );
    delete fixture.password;
  }
  const [a, b, administrator] = fixtures;
  checked(
    await trusted.from("entities").insert({
      id: entityId,
      entity_type: "person",
      display_name: "Disposable shared admin-support entity",
      visibility: "public",
      created_by: a.id,
    }),
  );
  for (const u of [a, b]) {
    checked(
      await u.db.from("user_contacts").insert({
        id: u.id,
        entity_id: entityId,
        follow_up_at: "2026-10-12",
        private_email: "fixture@example.test",
      }),
    );
    checked(
      await u.db.from("notes").insert({
        user_contact_id: u.id,
        body: "Separate private admin-support note",
      }),
    );
    checked(
      await u.db
        .from("lists")
        .insert({ id: u.id, name: "Separate support list" }),
    );
    checked(
      await u.db
        .from("list_members")
        .insert({ list_id: u.id, user_contact_id: u.id }),
    );
    checked(await u.db.from("saved_views").insert({ name: "Separate view" }));
    checked(
      await u.db.from("calendar_events").insert({
        id: u.id,
        title: "Fictional support gig",
        start_date: "2026-10-12",
        end_date: "2026-10-13",
        contact_id: u.id,
      }),
    );
    checked(
      await u.db.from("calendar_event_items").insert({
        event_id: u.id,
        label: "Fictional support guitar",
        quantity: 1,
      }),
    );
    checked(
      await trusted.from("sent_emails").insert({
        user_id: u.id,
        workspace_id: u.id,
        user_contact_id: u.id,
        recipient: "to@example.test",
        subject: "Fictional support message",
        body: "Never returned by support email metadata",
        gmail_message_id: "fictional-provider-id-not-returned",
      }),
    );
  }
  checked(
    await trusted.from("gmail_connections").insert({
      user_id: b.id,
      email: "fixture@example.test",
      encrypted_tokens: "fictional-encrypted-value-not-a-credential",
    }),
  );
  step = "ordinary member isolation and privilege denial";
  for (const [u, other] of [
    [a, b],
    [b, a],
  ]) {
    assert.equal((await u.page.goto(origin + "/admin")).status(), 404);
    for (const path of [
      "/api/admin/support?view=users",
      "/api/admin/support?view=audit",
      `/api/admin/entity?id=${entityId}`,
      "/api/admin/records?table=genres",
    ])
      assert.equal((await u.page.request.get(origin + path)).status(), 403);
    for (const path of ["/api/admin", "/api/admin/roles", "/api/admin/records"])
      assert.equal(
        (
          await u.page.request.post(origin + path, {
            headers: { Origin: origin },
            data: { userId: u.id, role: "admin", confirmed: true },
          })
        ).status(),
        403,
      );
    assert.ok(
      (
        await u.db
          .from("user_roles")
          .update({ role: "admin" })
          .eq("user_id", u.id)
      ).error,
    );
    assert.ok(
      (await u.db.from("user_roles").insert({ user_id: u.id, role: "admin" }))
        .error,
    );
    assert.ok(
      (await u.db.from("user_roles").delete().eq("user_id", u.id)).error,
    );
    assert.ok(
      (
        await u.db.rpc("admin_change_role", {
          target_user_id: u.id,
          new_role: "admin",
          confirmed: true,
        })
      ).error,
    );
    assert.ok(
      (
        await u.db.rpc("admin_workspace_records", {
          selected_workspace_id: other.id,
          section: "notes",
        })
      ).error,
    );
    for (const table of [
      "user_contacts",
      "notes",
      "lists",
      "list_members",
      "saved_views",
      "interactions",
      "sent_emails",
      "calendar_events",
      "calendar_event_items",
    ])
      assert.equal(
        checked(
          await u.db
            .from(table)
            .select("workspace_id")
            .eq("workspace_id", other.id),
        ).length,
        0,
      );
    assert.equal(
      checked(await u.db.from("entities").select("id").eq("id", entityId))
        .length,
      1,
    );
    assert.equal(
      checked(await u.db.from("admin_audit_log").select("id")).length,
      0,
    );
    assert.ok(
      (
        await u.db
          .from("admin_audit_log")
          .insert({ action: "forged", target_type: "user" })
      ).error,
    );
    assert.ok(
      (
        await u.db
          .from("admin_audit_log")
          .update({ metadata: {} })
          .eq("target_id", u.id)
      ).error,
    );
    assert.ok(
      (await u.db.from("admin_audit_log").delete().eq("target_id", u.id)).error,
    );
  }
  step = "trusted admin promotion and read-only support";
  checked(
    await trusted
      .from("user_roles")
      .update({ role: "admin" })
      .eq("user_id", administrator.id),
  );
  assert.equal(
    (await administrator.page.goto(origin + "/admin")).status(),
    200,
  );
  await administrator.page
    .getByRole("heading", { name: "MusicMail administration." })
    .waitFor();
  const get = async (path) => {
    const response = await administrator.page.request.get(origin + path);
    assert.equal(response.status(), 200);
    assert.equal(response.headers()["cache-control"], "private, no-store");
    const data = await response.json();
    safePayload(data);
    return data;
  };
  const post = (path, data, requestOrigin = origin) =>
    administrator.page.request.post(origin + path, {
      headers: { Origin: requestOrigin },
      data,
    });
  const info = await get(`/api/admin/support?view=users&userId=${b.id}`);
  assert.equal(info.items[0].email, b.email);
  assert.equal(info.items[0].role, "member");
  assert.equal(info.items[0].workspaces[0].workspace_id, b.id);
  const overview = await get("/api/admin/support?view=workspaces");
  assert.ok(overview.total >= 3);
  for (const u of [a, b]) {
    for (const section of [
      "contacts",
      "notes",
      "lists",
      "list_members",
      "saved_views",
      "interactions",
      "email_metadata",
      "calendar_events",
      "equipment",
      "gmail_status",
    ]) {
      const result = await get(
        `/api/admin/support?view=records&workspaceId=${u.id}&section=${section}`,
      );
      assert.equal(result.items.length, section === "interactions" ? 2 : 1);
      if (section === "gmail_status")
        assert.equal(result.items[0].connected, u.id === b.id);
    }
    assert.equal(
      checked(
        await administrator.db
          .from("notes")
          .select("id")
          .eq("workspace_id", u.id),
      ).length,
      0,
      "Blanket private read privilege was added",
    );
  }
  step = "canonical mutation, audit and protected roles";
  assert.equal(
    (
      await post("/api/admin", {
        action: "taxonomy",
        table: "genres",
        name: taxonomyName,
      })
    ).status(),
    200,
  );
  taxonomyId = checked(
    await trusted.from("genres").select("id").eq("name", taxonomyName).single(),
  ).id;
  assert.ok(
    checked(
      await trusted
        .from("admin_audit_log")
        .select("id")
        .eq("admin_user_id", administrator.id)
        .eq("target_id", taxonomyId)
        .eq("action", "insert"),
    ).length,
  );
  assert.equal(
    (
      await post("/api/admin/roles", {
        userId: b.id,
        role: "admin",
        confirmed: false,
      })
    ).status(),
    400,
  );
  assert.equal(
    (
      await post(
        "/api/admin/roles",
        { userId: b.id, role: "admin", confirmed: true },
        "https://elsewhere.example",
      )
    ).status(),
    400,
  );
  assert.equal(
    (
      await post("/api/admin/roles", {
        userId: administrator.id,
        role: "member",
        confirmed: true,
      })
    ).status(),
    400,
  );
  assert.equal(
    (
      await post("/api/admin/roles", {
        userId: b.id,
        role: "admin",
        confirmed: true,
      })
    ).status(),
    200,
  );
  assert.equal(checked(await b.db.rpc("is_admin")), true);
  assert.equal(
    (
      await b.page.request.get(origin + "/api/admin/support?view=users")
    ).status(),
    200,
  );
  assert.ok(
    checked(
      await trusted
        .from("admin_audit_log")
        .select("id")
        .eq("admin_user_id", administrator.id)
        .eq("target_id", b.id)
        .eq("action", "update"),
    ).length,
  );
  step = "concurrent administrator revocation";
  const race = await Promise.all([
    administrator.db.rpc("admin_change_role", {
      target_user_id: b.id,
      new_role: "member",
      confirmed: true,
    }),
    b.db.rpc("admin_change_role", {
      target_user_id: administrator.id,
      new_role: "member",
      confirmed: true,
    }),
  ]);
  assert.equal(
    race.filter((r) => r.error).length,
    1,
    "Simultaneous demotions did not serialize/recheck authorization",
  );
  const surviving = checked(
    await trusted
      .from("user_roles")
      .select("role")
      .in("user_id", [administrator.id, b.id]),
  );
  assert.equal(
    surviving.filter((r) => r.role === "admin").length,
    1,
    "Simultaneous demotions removed both administrators",
  );
  // Restore only disposable fixture roles for the remaining independent checks.
  checked(
    await trusted
      .from("user_roles")
      .update({ role: "admin" })
      .eq("user_id", administrator.id),
  );
  checked(
    await trusted
      .from("user_roles")
      .update({ role: "admin" })
      .eq("user_id", b.id),
  );
  step = "canonical mutation, audit and protected roles";
  assert.equal(
    (
      await post("/api/admin/roles", {
        userId: b.id,
        role: "member",
        confirmed: true,
      })
    ).status(),
    200,
  );
  assert.equal(checked(await b.db.rpc("is_admin")), false);
  assert.equal(
    (
      await b.page.request.get(origin + "/api/admin/support?view=users")
    ).status(),
    403,
  );
  assert.equal(
    checked(await b.db.from("notes").select("id").eq("workspace_id", a.id))
      .length,
    0,
  );
  assert.ok(
    (
      await administrator.db
        .from("admin_audit_log")
        .delete()
        .eq("admin_user_id", administrator.id)
    ).error,
  );
  const audit = await get("/api/admin/support?view=audit");
  assert.ok(audit.total >= 22);
  step = "administrator UI in light/dark/mobile";
  const page = administrator.page;
  await page.getByLabel("View", { exact: true }).selectOption("records");
  await page.getByLabel("Workspace UUID", { exact: true }).fill(b.id);
  await page.getByRole("button", { name: "Load support records" }).click();
  await page.getByText("1 records. Showing 1–1.", { exact: true }).waitFor();
  const a11y = async () => {
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.equal(
      result.violations.length,
      0,
      "Admin UI accessibility violation",
    );
  };
  for (const theme of ["light", "dark"]) {
    assert.equal(
      (
        await page.request.post(origin + "/api/appearance", {
          headers: { Origin: origin },
          data: { theme },
        })
      ).status(),
      200,
    );
    await page.reload();
    await page
      .getByRole("heading", { name: "MusicMail administration." })
      .waitFor();
    await page.getByLabel("View", { exact: true }).selectOption("records");
    await page.getByLabel("Workspace UUID", { exact: true }).fill(b.id);
    await page.getByRole("button", { name: "Load support records" }).click();
    await page.getByText("1 records. Showing 1–1.", { exact: true }).waitFor();
    await a11y();
    if (process.env.MUSICMAIL_ADMIN_SCREENSHOTS === "true") {
      mkdirSync("docs/screenshots", { recursive: true });
      await page.screenshot({
        path: `docs/screenshots/admin-support-${theme}.png`,
        fullPage: false,
      });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await a11y();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Admin UI overflows mobile",
  );
  const cookie = (await administrator.context.cookies()).find(
    (c) => c.name.startsWith("sb-") && c.name.includes("auth-token"),
  );
  assert.ok(cookie?.httpOnly);
  assert.equal(cookie?.sameSite, "Lax");
  assert.ok(
    !(await page.evaluate(() => document.cookie)).includes("auth-token"),
  );
  step = "revocation on an existing session";
  checked(
    await trusted
      .from("user_roles")
      .update({ role: "member" })
      .eq("user_id", administrator.id),
  );
  assert.equal(
    (await page.request.get(origin + "/api/admin/support?view=users")).status(),
    403,
  );
  assert.equal((await page.goto(origin + "/admin")).status(), 404);
  assert.ok(
    (
      await administrator.db.from("genres").insert({
        name: "Revoked admin must fail",
        slug: "revoked-admin-must-fail",
      })
    ).error,
  );
  console.log(
    `Hosted administrator acceptance passed (${assertions} assertions): real A/B/admin Auth sessions, metadata spoofing, protected pages/APIs, role CRUD/RPC denial, shared canonical reads, separate overlays, every support category, provider/secret allowlists, audited canonical/role changes, CSRF, cookies, concurrent demotion safety, immediate revocation and light/dark/mobile accessibility. No email sent.`,
  );
} catch (error) {
  console.error("Hosted administrator acceptance failed at: " + step);
  const frame = String(error.stack || "")
    .split("\n")
    .find((line) => line.includes("test-hosted-admin.mjs:"));
  if (frame) console.error(error.name + " " + frame.trim());
  if (
    typeof error.cause === "string" &&
    /^[A-Za-z0-9_]{1,20}$/.test(error.cause)
  )
    console.error("Provider error code: " + error.cause);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  for (const u of fixtures)
    if ((await trusted.auth.admin.deleteUser(u.id)).error) {
      console.error("Administrator fixture cleanup failed.");
      process.exitCode = 1;
    }
  for (const [table, id] of [
    ["entities", entityId],
    ["genres", taxonomyId],
  ])
    if (id && (await trusted.from(table).delete().eq("id", id)).error) {
      console.error("Canonical fixture cleanup failed.");
      process.exitCode = 1;
    }
  console.log(
    "Disposable administrator fixtures removed; immutable safe audit entries retained.",
  );
}
