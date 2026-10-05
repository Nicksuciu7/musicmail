import type { Workspace } from "./domain";

// Export business data explicitly. Never serialize an Auth/session/provider object
// or automatically include newly added database columns.
function pick(value: unknown, fields: string[]) {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    fields
      .filter((field) => field in record)
      .map((field) => [field, record[field]]),
  );
}
const auditFields = ["id", "workspace_id", "created_at", "updated_at"];
export function exportWorkspace(w: Workspace) {
  return {
    formatVersion: 1,
    email: w.email,
    gmailEmail: w.gmailEmail,
    profile: pick(w.profile, [
      "display_name",
      "timezone",
      "country",
      "created_at",
      "updated_at",
    ]),
    artist: pick(w.artist, [
      "id",
      "name",
      "type",
      "location",
      "genres",
      "emotions",
    ]),
    artistName: w.artistName,
    onboarded: w.onboarded,
    goals: w.goals,
    contacts: w.contacts.map((c) => ({
      ...pick(c, [
        ...auditFields,
        "entity_id",
        "private_display_name",
        "private_email",
        "private_details",
        "relationship_status",
        "outreach_status",
        "priority",
        "follow_up_at",
        "last_contacted_at",
        "relationship_origin",
        "archived",
      ]),
      entity: c.entity
        ? {
            ...pick(c.entity, [
              "id",
              "entity_type",
              "display_name",
              "description",
              "location",
              "roles",
              "organisation",
              "organisation_type",
              "genres",
              "emotions",
              "email",
              "website",
              "verification_status",
              "submission_status",
              "submission_type",
              "submission_instructions",
              "aliases",
              "source",
              "source_url",
              "verified_at",
              "capacity",
            ]),
            contact_methods: c.entity.contact_methods?.map((m) =>
              pick(m, ["id", "contact_type", "value", "label", "purpose"]),
            ),
          }
        : null,
    })),
    notes: w.notes.map((n) =>
      pick(n, [...auditFields, "user_contact_id", "body", "pinned"]),
    ),
    interactions: w.interactions.map((i) =>
      pick(i, [
        ...auditFields,
        "user_contact_id",
        "type",
        "title",
        "metadata",
        "occurred_at",
      ]),
    ),
    lists: w.lists.map((l) => pick(l, [...auditFields, "name", "description"])),
    members: w.members.map((m) =>
      pick(m, [...auditFields, "list_id", "user_contact_id"]),
    ),
    views: w.views.map((v) =>
      pick(v, [
        ...auditFields,
        "name",
        "scope",
        "filter_definition",
        "visible_columns",
      ]),
    ),
    templates: w.templates.map((t) =>
      pick(t, [...auditFields, "name", "category", "subject", "body"]),
    ),
    sent: w.sent.map((s) =>
      pick(s, [
        ...auditFields,
        "user_contact_id",
        "gmail_message_id",
        "recipient",
        "subject",
        "body",
        "sent_at",
      ]),
    ),
  };
}
