import "server-only";
import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { demoWorkspace, entities } from "../fixtures";
import {
  duplicateKey,
  contactEmail,
  contactName,
  type Action,
  type Contact,
  type Workspace,
} from "../domain";
const directory = join(process.cwd(), ".data", "demo");
export function readDemo(id: string): Workspace {
  try {
    const state = JSON.parse(
      readFileSync(join(directory, `${id}.json`), "utf8"),
    ) as Workspace;
    state.contacts = state.contacts.map((c) => ({
      ...c,
      entity: entities.find((e) => e.id === c.entity_id),
    }));
    return state;
  } catch {
    return demoWorkspace();
  }
}
export function writeDemo(id: string, w: Workspace) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, `${id}.json`);
  writeFileSync(path + ".tmp", JSON.stringify(w), { mode: 0o600 });
  renameSync(path + ".tmp", path);
}
export function mutateDemo(id: string, a: Action) {
  const w = readDemo(id);
  const now = new Date().toISOString();
  const uid = () => crypto.randomUUID();
  const history = (cid: string, type: string, title: string) =>
    w.interactions.unshift({
      id: uid(),
      user_contact_id: cid,
      type,
      title,
      occurred_at: now,
    });
  const create = (c: Partial<Contact>) => {
    const contact: Contact = {
      id: uid(),
      entity_id: null,
      private_display_name: null,
      private_email: null,
      private_details: {},
      relationship_status: "unknown",
      outreach_status: "not_contacted",
      priority: null,
      follow_up_at: null,
      last_contacted_at: null,
      relationship_origin: null,
      archived: false,
      created_at: now,
      ...c,
    };
    w.contacts.unshift(contact);
    history(contact.id, "contact_added", "Added to your network");
    return contact;
  };
  const addPrivate = (p: Extract<Action, { action: "private" }>["contact"]) => {
    const c = create({
      private_display_name: p.name,
      private_email: p.email,
      private_details: {
        organisation: p.organisation,
        role: p.role,
        location: p.location,
        genres: p.genres,
      },
      relationship_status: p.relationship,
    });
    if (p.notes) {
      w.notes.unshift({
        id: uid(),
        user_contact_id: c.id,
        body: p.notes,
        pinned: false,
        created_at: now,
      });
      history(c.id, "note_added", "Private note added");
    }
  };
  switch (a.action) {
    case "profile":
      w.profile = {
        display_name: a.display_name,
        timezone: a.timezone,
        country: a.country,
      };
      break;
    case "add": {
      const e = entities.find((e) => e.id === a.entityId);
      if (!e) throw new Error("Entity not found.");
      const c = w.contacts.find((c) => c.entity_id === e.id);
      if (c) c.archived = false;
      else create({ entity_id: e.id, entity: e });
      break;
    }
    case "private":
      addPrivate(a.contact);
      break;
    case "update": {
      const c = w.contacts.find((c) => c.id === a.id);
      if (!c) throw new Error("Contact not found.");
      for (const [key, value] of Object.entries(a.patch))
        if (c[key as keyof Contact] !== value)
          history(
            c.id,
            key === "follow_up_at" ? "follow_up_changed" : key,
            "Updated " + key.replaceAll("_", " "),
          );
      Object.assign(c, a.patch);
      break;
    }
    case "note":
      if (!w.contacts.some((c) => c.id === a.id))
        throw new Error("Contact not found.");
      w.notes.unshift({
        id: uid(),
        user_contact_id: a.id,
        body: a.body,
        pinned: false,
        created_at: now,
      });
      history(a.id, "note_added", "Private note added");
      break;
    case "list":
      w.lists.push({ id: uid(), name: a.name });
      break;
    case "member":
      if (
        !w.lists.some((l) => l.id === a.listId) ||
        a.contactIds.some((id) => !w.contacts.some((c) => c.id === id))
      )
        throw new Error("List or contact not found.");
      for (const cid of a.contactIds) {
        w.members = w.members.filter(
          (m) => !(m.list_id === a.listId && m.user_contact_id === cid),
        );
        if (!a.remove)
          w.members.push({ list_id: a.listId, user_contact_id: cid });
      }
      break;
    case "view":
      w.views.push({
        id: uid(),
        name: a.name,
        filter_definition: a.filters,
        scope: a.scope,
        visible_columns: a.columns,
      });
      break;
    case "template": {
      const index = w.templates.findIndex((t) => t.id === a.id);
      const t = { id: a.id || uid(), ...a.template };
      if (index < 0) w.templates.push(t);
      else w.templates[index] = t;
      break;
    }
    case "deleteTemplate":
      w.templates = w.templates.filter((t) => t.id !== a.id);
      break;
    case "deleteList":
      w.lists = w.lists.filter((l) => l.id !== a.id);
      w.members = w.members.filter((m) => m.list_id !== a.id);
      break;
    case "import": {
      const keys = new Set(
        w.contacts.map((c) =>
          duplicateKey(
            contactEmail(c),
            contactName(c),
            c.private_details.organisation || "",
          ),
        ),
      );
      for (const p of a.contacts) {
        const key = duplicateKey(p.email, p.name, p.organisation);
        if (keys.has(key) && !a.confirmDuplicates)
          throw new Error("Possible duplicates. Confirm before importing.");
        keys.add(key);
      }
      a.contacts.forEach(addPrivate);
      break;
    }
    case "onboard":
      w.artistName = a.name;
      w.artist = {
        id: w.artist?.id || uid(),
        name: a.name,
        type: a.type,
        location: a.location,
        genres: a.genres,
        emotions: a.emotions,
      };
      w.onboarded = true;
      w.goals = a.goals;
      break;
  }
  writeDemo(id, w);
  return w;
}
