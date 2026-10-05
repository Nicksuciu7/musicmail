// Explicit hosted acceptance test. Creates only disposable .test accounts and
// one labelled canonical test entity; deletes them in finally. No email is sent.
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const pub = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !pub || !secret)
  throw new Error("Hosted test configuration missing");
const options = {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (u, o) => fetch(u, { ...o, signal: AbortSignal.timeout(20000) }),
  },
};
const admin = createClient(url, secret, options);
const users = [];
const entityId = randomUUID();
const venueId = randomUUID();
let venueCreated = false;
let entityCreated = false;
function checked(result, label) {
  if (result.error)
    throw new Error(
      `${label}: ${result.error.code || result.error.status || "request failed"}`,
    );
  return result.data;
}
const tables = [
  "user_contacts",
  "notes",
  "lists",
  "list_members",
  "saved_views",
  "interactions",
  "email_templates",
  "sent_emails",
  "calendar_events",
  "calendar_event_items",
];
let assertions = 0;
function check(value, label) {
  assert.ok(value, label);
  assertions++;
}
try {
  for (const label of ["a", "b"]) {
    const email = `musicmail-isolation-${label}-${randomUUID()}@example.test`;
    const password = `Mm1!${randomBytes(24).toString("base64url")}`;
    const { user } = checked(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: "Disposable isolation test" },
      }),
      "Create test account",
    );
    users.push({ id: user.id, email, password });
  }
  checked(
    await admin.from("entities").insert({
      id: entityId,
      entity_type: "person",
      display_name: "Disposable MusicMail isolation test",
      visibility: "public",
      created_by: users[0].id,
    }),
    "Create canonical fixture",
  );
  entityCreated = true;
  checked(
    await admin
      .from("entities")
      .insert({
        id: venueId,
        entity_type: "venue",
        display_name: "Disposable MusicMail calendar venue",
        visibility: "public",
        created_by: users[0].id,
      }),
    "Canonical venue fixture",
  );
  venueCreated = true;
  for (const u of users) {
    u.db = createClient(url, pub, options);
    // Admin-generated disposable email proof establishes a real user JWT without
    // an interactive CAPTCHA. All RLS assertions below use the user client.
    const fixtureLink = checked(
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email: u.email,
      }),
      "Fixture email proof",
    );
    checked(
      await u.db.auth.verifyOtp({
        type: "magiclink",
        token_hash: fixtureLink.properties.hashed_token,
      }),
      "Fixture Auth login",
    );
    delete u.password;
    check(
      checked(
        await u.db.from("workspaces").select("id").eq("id", u.id),
        "Workspace provisioning",
      ).length === 1,
      "Personal workspace missing",
    );
    const contact = checked(
      await u.db
        .from("user_contacts")
        .insert({ entity_id: entityId, follow_up_at: "2026-10-01" })
        .select()
        .single(),
      "Own contact",
    );
    u.contact = contact;
    checked(
      await u.db.from("notes").insert({
        user_contact_id: contact.id,
        body: "Disposable private note",
      }),
      "Own note",
    );
    const list = checked(
      await u.db
        .from("lists")
        .insert({ name: "Disposable private list" })
        .select()
        .single(),
      "Own list",
    );
    u.list = list;
    checked(
      await u.db
        .from("list_members")
        .insert({ list_id: list.id, user_contact_id: contact.id }),
      "Own membership",
    );
    checked(
      await u.db
        .from("saved_views")
        .insert({ name: "Disposable private view" }),
      "Own view",
    );
    checked(
      await u.db
        .from("email_templates")
        .insert({ name: "Disposable template", subject: "Test", body: "Test" }),
      "Own template",
    );
    u.event = checked(
      await u.db
        .from("calendar_events")
        .insert({
          title: "Disposable private gig",
          start_date: "2026-10-12",
          end_date: "2026-10-13",
          contact_id: contact.id,
          venue_entity_id: venueId,
        })
        .select()
        .single(),
      "Own calendar event",
    );
    u.item = checked(
      await u.db
        .from("calendar_event_items")
        .insert({ event_id: u.event.id, label: "Martin D-28" })
        .select()
        .single(),
      "Own checklist",
    );
    const attempt = randomUUID();
    checked(
      await admin.rpc("reserve_email", {
        attempt_id: attempt,
        owner_id: u.id,
        contact_id: contact.id,
      }),
      "Reserve metadata fixture",
    );
    checked(
      await admin.rpc("record_sent", {
        attempt_id: attempt,
        owner_id: u.id,
        contact_id: contact.id,
        message_id: "synthetic-test-no-email-sent",
        to_email: "recipient@example.test",
        message_subject: "Test metadata",
        message_body: "No email was sent",
      }),
      "Record metadata fixture",
    );
  }
  for (const u of users) {
    const other = users.find((x) => x.id !== u.id);
    check(
      checked(
        await u.db.from("entities").select("id").eq("id", entityId),
        "Shared entity read",
      ).length === 1,
      "Shared entity unavailable",
    );
    check(
      checked(
        await u.db
          .from("user_contacts")
          .select("follow_up_at")
          .eq("id", u.contact.id),
        "Own follow-up",
      )[0].follow_up_at === "2026-10-01",
      "Follow-up missing",
    );
    for (const table of tables) {
      const own = checked(
        await u.db.from(table).select("*").eq("workspace_id", u.id),
        "Own read",
      );
      check(own.length > 0, `Own ${table} missing`);
      check(
        checked(
          await u.db.from(table).select("*").eq("workspace_id", other.id),
          "Cross read",
        ).length === 0,
        `Cross read ${table}`,
      );
      const updated = await u.db
        .from(table)
        .update({ workspace_id: other.id })
        .eq("workspace_id", other.id)
        .select();
      check(
        table === "sent_emails"
          ? Boolean(updated.error)
          : !updated.error && updated.data.length === 0,
        `Cross update ${table}`,
      );
      const deleted = await u.db
        .from(table)
        .delete()
        .eq("workspace_id", other.id)
        .select();
      check(
        table === "sent_emails"
          ? Boolean(deleted.error)
          : !deleted.error && deleted.data.length === 0,
        `Cross delete ${table}`,
      );
      const row = { ...own[0], workspace_id: other.id, user_id: u.id };
      if ("id" in row) row.id = randomUUID();
      if ("user_contact_id" in row) row.user_contact_id = other.contact.id;
      if ("list_id" in row) row.list_id = other.list.id;
      if ("event_id" in row) row.event_id = other.event.id;
      const inserted = await u.db.from(table).insert(row);
      check(
        inserted.error?.code === "42501",
        `Cross insert must fail by authorization: ${table}`,
      );
    }
    check(
      checked(
        await u.db.from("entities").select("id").eq("id", venueId),
        "Shared venue read",
      ).length === 1,
      "Same permitted canonical venue",
    );
    check(
      (
        await u.db
          .from("calendar_events")
          .update({ contact_id: other.contact.id })
          .eq("id", u.event.id)
      ).error?.code === "23503",
      "Cross-workspace calendar contact denied",
    );
    check(
      (
        await u.db
          .from("calendar_event_items")
          .insert({ event_id: other.event.id, label: "Cross-parent attack" })
      ).error?.code === "23503",
      "Cross-workspace event parent denied",
    );
    check(
      (
        await u.db
          .from("calendar_events")
          .update({ venue_entity_id: entityId })
          .eq("id", u.event.id)
      ).error?.code === "42501",
      "Non-venue rejected",
    );
    check(
      (
        await u.db
          .from("calendar_events")
          .update({ user_id: other.id })
          .eq("id", u.event.id)
      ).error?.code === "42501",
      "Calendar actor immutable",
    );
    check(
      (
        await u.db
          .from("calendar_event_items")
          .update({ workspace_id: other.id })
          .eq("id", u.item.id)
      ).error?.code === "42501",
      "Checklist workspace immutable",
    );
    checked(
      await u.db
        .from("calendar_event_items")
        .update({ completed: true })
        .eq("id", u.item.id),
      "Own item check",
    );
    check(
      checked(
        await u.db
          .from("calendar_event_items")
          .select("completed")
          .eq("id", u.item.id)
          .single(),
        "Own checked read",
      ).completed,
      "Checklist persisted",
    );
    check(
      (
        await u.db.rpc("save_calendar_event", {
          event_id: other.event.id,
          payload: {},
          checklist: [],
        })
      ).error?.code === "42501",
      "Cross-workspace calendar RPC denied",
    );
    const payload = {
      title: "Atomic hosted gig",
      event_type: "Gig",
      start_date: "2026-10-12",
      end_date: "2026-10-13",
      all_day: true,
      timezone: "Europe/London",
      location_name: "",
      address: "",
      promoter: "",
      fee: "",
      ticket_url: "",
      notes: "",
    };
    const eid = checked(
      await u.db.rpc("save_calendar_event", {
        event_id: null,
        payload: { ...payload, workspace_id: other.id },
        checklist: [{ label: "mics", quantity: 2 }],
      }),
      "Atomic hosted create",
    );
    check(
      checked(
        await u.db
          .from("calendar_events")
          .select("workspace_id")
          .eq("id", eid)
          .single(),
        "Atomic owner",
      ).workspace_id === u.id,
      "RPC cannot override workspace",
    );
    check(
      (
        await u.db.rpc("save_calendar_event", {
          event_id: eid,
          payload: { ...payload, title: "Must rollback" },
          checklist: [{ id: other.item.id, label: "Stolen" }],
        })
      ).error?.code === "42501",
      "RPC foreign checklist denied",
    );
    check(
      checked(
        await u.db
          .from("calendar_events")
          .select("title")
          .eq("id", eid)
          .single(),
        "Atomic rollback",
      ).title === payload.title,
      "Failed edit rolled back",
    );
    checked(
      await u.db.from("calendar_events").delete().eq("id", eid),
      "Own event delete",
    );
    check(
      checked(
        await u.db
          .from("calendar_event_items")
          .select("id")
          .eq("event_id", eid),
        "Cascade check",
      ).length === 0,
      "Event deletion cleans checklist",
    );
    check(
      (
        await u.db
          .from("workspace_members")
          .insert({ workspace_id: other.id, user_id: u.id, role: "owner" })
      ).error?.code === "42501",
      "Membership escalation",
    );
    check(
      (await u.db.from("gmail_connections").select("*")).error?.code ===
        "42501",
      "Provider tokens accessible",
    );
    check(
      (
        await u.db.rpc("reserve_email", {
          attempt_id: randomUUID(),
          owner_id: other.id,
          contact_id: other.contact.id,
        })
      ).error !== null,
      "Service RPC exposed",
    );
    const exportDoc = checked(
      await u.db.rpc("workspace_document"),
      "Private export",
    );
    check(
      exportDoc.contacts.length === 1 &&
        exportDoc.contacts[0].id === u.contact.id,
      "Export isolation",
    );
  }
  const anon = createClient(url, pub, options);
  for (const table of [
    ...tables,
    "profiles",
    "workspaces",
    "workspace_members",
    "gmail_connections",
  ])
    check(
      (await anon.from(table).select("*")).error?.code === "42501",
      `Anonymous access ${table}`,
    );
  for (const u of users) {
    checked(
      await admin.auth.admin.deleteUser(u.id),
      "Disposable account delete",
    );
    u.deleted = true;
    for (const table of ["calendar_events", "calendar_event_items"])
      check(
        checked(
          await admin.from(table).select("id").eq("workspace_id", u.id),
          "Deleted calendar cleanup",
        ).length === 0,
        `Account deletion cleans ${table}`,
      );
  }
  check(
    checked(
      await admin
        .from("entities")
        .select("created_by")
        .eq("id", venueId)
        .single(),
      "Venue retained",
    ).created_by === null,
    "Canonical venue survives account deletion",
  );
  console.log(
    `Hosted isolation passed: ${assertions} assertions, both directions, disposable Auth users, shared canonical entity and separate CRM overlays. No email sent.`,
  );
} finally {
  let cleanupFailed = false;
  for (const u of users) {
    if (u.db) await u.db.auth.signOut();
    if (u.deleted) continue;
    const r = await admin.auth.admin.deleteUser(u.id);
    if (r.error) cleanupFailed = true;
  }
  if (entityCreated) {
    const retained = await admin
      .from("entities")
      .select("created_by")
      .eq("id", entityId)
      .single();
    if (retained.error || retained.data.created_by !== null) {
      console.error("Public entity preservation check failed");
      process.exitCode = 1;
    }
    const r = await admin.from("entities").delete().eq("id", entityId);
    if (r.error) cleanupFailed = true;
  }
  if (venueCreated) {
    const r = await admin.from("entities").delete().eq("id", venueId);
    if (r.error) cleanupFailed = true;
  }
  if (cleanupFailed) {
    console.error(
      "Test fixture cleanup incomplete; inspect labelled MusicMail isolation fixtures.",
    );
    process.exitCode = 1;
  } else console.log("Disposable hosted fixtures removed.");
}
