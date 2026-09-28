import "server-only";
import { checked, identity, supabase, serviceClient } from "./supabase";
import { readDemo, mutateDemo } from "./demo";
import { entities } from "../fixtures";
import {
  matchesEntity,
  duplicateKey,
  contactEmail,
  contactName,
  type Workspace,
  type Entity,
  type Action,
  type Filters,
} from "../domain";
export async function workspace(
  full = false,
  contactIds: string[] = [],
): Promise<Workspace> {
  const user = await identity();
  if (user.demo) {
    const w = readDemo(user.id);
    if (full) return w;
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: w.profile?.timezone||"Europe/London",
    });
    const active = w.contacts.filter((c) => !c.archived);
    const picked = new Set(
      [
        ...active.slice(0, 50),
        ...active
          .filter((c) => c.follow_up_at && c.follow_up_at <= today)
          .sort((a, b) => a.follow_up_at!.localeCompare(b.follow_up_at!))
          .slice(0, 50),
        ...active
          .filter((c) => c.follow_up_at && c.follow_up_at > today)
          .sort((a, b) => a.follow_up_at!.localeCompare(b.follow_up_at!))
          .slice(0, 50),
      ]
        .map((c) => c.id)
        .concat(contactIds),
    );
    return {
      ...w,
      contactCount: active.length,
      networkEntityIds: active.flatMap((c) =>
        c.entity_id ? [c.entity_id] : [],
      ),
      contacts: w.contacts.filter((c) => picked.has(c.id)),
      notes: w.notes.filter((n) => contactIds.includes(n.user_contact_id)),
      interactions: w.interactions
        .filter((i) => contactIds.includes(i.user_contact_id))
        .slice(0, 100),
      members: w.members.filter((m) => picked.has(m.user_contact_id)),
      lists: w.lists.map((l) => ({
        ...l,
        member_count: w.members.filter((m) => m.list_id === l.id).length,
      })),
      sent: w.sent.slice(0, 20),
    };
  }
  const db = await supabase();
  const document = checked(
    full
      ? await db.rpc("workspace_document")
      : await db.rpc("workspace_summary", { contact_ids: contactIds }),
  ) as Omit<Workspace, "demo" | "email" | "gmailEmail">;
  const connection = checked(
    await serviceClient()
      .from("gmail_connections")
      .select("email")
      .eq("user_id", user.id)
      .maybeSingle(),
  );
  return {
    ...document,
    demo: false,
    email: user.email,
    gmailEmail: connection?.email || null,
  };
}
export async function discover(filters: Filters) {
  const user = await identity();
  if (user.demo) {
    const items = entities
      .filter((e) => matchesEntity(e, filters))
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
    return {
      items: items.slice((filters.page - 1) * 12, filters.page * 12),
      total: items.length,
    };
  }
  return checked(
    await (await supabase()).rpc("discover_entities", { filters }),
  ) as { items: Entity[]; total: number };
}
export async function mutate(a: Action) {
  const user = await identity();
  if (user.demo) {
    mutateDemo(user.id, a);
    const selected =
      a.action === "note" || a.action === "update"
        ? [a.id]
        : a.action === "member"
          ? a.contactIds
          : a.action === "add"
            ? readDemo(user.id)
                .contacts.filter((c) => c.entity_id === a.entityId)
                .map((c) => c.id)
            : [];
    return workspace(false, selected);
  }
  const db = await supabase();
  const owner = { user_id: user.id };
  switch (a.action) {
    case "profile":checked(await db.from("profiles").upsert({id:user.id,display_name:a.display_name,timezone:a.timezone,country:a.country}));break;
    case "add": {
      const entity = checked(await db.rpc("get_entity", { eid: a.entityId }));
      if (!entity) throw new Error("Entity unavailable.");
      checked(
        await db
          .from("user_contacts")
          .upsert(
            { ...owner, entity_id: a.entityId, archived: false },
            { onConflict: "user_id,entity_id" },
          ),
      );
      break;
    }
    case "private":
      checked(
        await db.rpc("import_contacts", {
          rows: [a.contact],
          confirm_duplicates: true,
        }),
      );
      break;
    case "update":
      checked(
        await db
          .from("user_contacts")
          .update(a.patch)
          .eq("id", a.id)
          .eq("user_id", user.id)
          .select()
          .single(),
      );
      break;
    case "note":
      checked(
        await db
          .from("notes")
          .insert({ ...owner, user_contact_id: a.id, body: a.body }),
      );
      break;
    case "list":
      checked(await db.from("lists").insert({ ...owner, name: a.name }));
      break;
    case "member":
      if (a.remove)
        checked(
          await db
            .from("list_members")
            .delete()
            .eq("list_id", a.listId)
            .in("user_contact_id", a.contactIds),
        );
      else
        checked(
          await db.from("list_members").upsert(
            a.contactIds.map((id) => ({
              ...owner,
              list_id: a.listId,
              user_contact_id: id,
            })),
            { onConflict: "list_id,user_contact_id" },
          ),
        );
      break;
    case "view":
      checked(
        await db.from("saved_views").insert({
          ...owner,
          name: a.name,
          filter_definition: a.filters,
          scope: a.scope,
          visible_columns: a.columns,
        }),
      );
      break;
    case "template":
      checked(
        await db
          .from("email_templates")
          .upsert({ ...owner, ...a.template, ...(a.id ? { id: a.id } : {}) }),
      );
      break;
    case "deleteTemplate":
      checked(await db.from("email_templates").delete().eq("id", a.id));
      break;
    case "deleteList":
      checked(await db.from("lists").delete().eq("id", a.id));
      break;
    case "import": {
      const w = await workspace(true);
      const keys = new Set(
        w.contacts.map((c) =>
          duplicateKey(
            contactEmail(c),
            contactName(c),
            c.private_details.organisation || "",
          ),
        ),
      );
      for (const c of a.contacts) {
        const key = duplicateKey(c.email, c.name, c.organisation);
        if (keys.has(key) && !a.confirmDuplicates)
          throw new Error("Possible duplicates. Confirm before importing.");
        keys.add(key);
      }
      checked(
        await db.rpc("import_contacts", {
          rows: a.contacts,
          confirm_duplicates: a.confirmDuplicates,
        }),
      );
      break;
    }
    case "onboard":
      checked(
        await db.rpc("complete_onboarding", {
          project_name: a.name,
          project_type: a.type,
          city_name: a.location,
          genre_names: a.genres,
          emotion_names: a.emotions,
          user_goals: a.goals,
        }),
      );
      break;
  }
  const selected =
    a.action === "note" || a.action === "update"
      ? [a.id]
      : a.action === "member"
        ? a.contactIds
        : [];
  if (a.action === "add") {
    const row = checked(
      await db
        .from("user_contacts")
        .select("id")
        .eq("entity_id", a.entityId)
        .single(),
    );
    selected.push(row.id);
  }
  return workspace(false, selected);
}
