import { z } from "zod";
import { expandGenres, genreParents } from "./taxonomy";
export const relationships = [
  "unknown",
  "cold",
  "contacted",
  "warm",
  "familiar",
  "met_personally",
  "worked_together",
  "strong_relationship",
] as const;
export const outreachStates = [
  "not_contacted",
  "draft",
  "sent",
  "replied",
  "interested",
  "declined",
  "follow_up_needed",
  "completed",
  "no_response",
  "do_not_contact",
] as const;
export const filterSchema = z.object({
  q: z.string().max(150).default(""),
  types: z
    .array(z.enum(["person", "organisation", "artist_project", "venue"]))
    .max(4)
    .default([]),
  roles: z.array(z.string().max(80)).max(30).default([]),
  organisationTypes: z.array(z.string().max(80)).max(30).default([]),
  locations: z.array(z.string().max(80)).max(30).default([]),
  genres: z.array(z.string().max(80)).max(30).default([]),
  emotions: z.array(z.string().max(80)).max(30).default([]),
  submission: z.enum(["", "open", "closed", "unknown"]).default(""),
  submissionType: z.string().max(40).default(""),
  email: z.boolean().default(false),
  verified: z.boolean().default(false),
  exclude: z.array(z.string().max(80)).max(30).default([]),
  relationship: z.string().default(""),
  outreach: z.string().default(""),
  priority: z.string().default(""),
  followUp: z.enum(["", "overdue", "today", "upcoming"]).default(""),
  lastContact: z.enum(["", "never", "recent", "older"]).default(""),
  list: z.string().default(""),
  sort: z.enum(["name", "recent"]).default("name"),
  page: z.number().int().min(1).max(10000).default(1),
});
export type Filters = z.infer<typeof filterSchema>;
export const emptyFilters = filterSchema.parse({});
export type Entity = {
  contact_methods?: {
    id: string;
    contact_type: string;
    value: string;
    label?: string | null;
    purpose?: string | null;
  }[];
  id: string;
  entity_type: "person" | "organisation" | "artist_project" | "venue";
  display_name: string;
  description: string;
  location: string;
  roles: string[];
  organisation: string;
  organisation_type: string;
  genres: string[];
  emotions: string[];
  email: string;
  website: string;
  verification_status: string;
  submission_status: string;
  submission_type: string;
  submission_instructions: string;
  aliases: string[];
  source: string;
  source_url: string;
  verified_at: string | null;
  capacity: number | null;
};
export type Contact = {
  id: string;
  entity_id: string | null;
  private_display_name: string | null;
  private_email: string | null;
  private_details: Record<string, string>;
  relationship_status: (typeof relationships)[number];
  outreach_status: (typeof outreachStates)[number];
  priority: "low" | "medium" | "high" | null;
  follow_up_at: string | null;
  last_contacted_at: string | null;
  relationship_origin: string | null;
  archived: boolean;
  created_at: string;
  entity?: Entity | null;
};
export type Note = {
  id: string;
  user_contact_id: string;
  body: string;
  pinned: boolean;
  created_at: string;
};
export type Interaction = {
  id: string;
  user_contact_id: string;
  type: string;
  title: string;
  occurred_at: string;
};
export type Template = {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
};
export type List = { id: string; name: string; member_count?: number };
export type SavedView = {
  scope?: "explore" | "network";
  id: string;
  name: string;
  filter_definition: Filters;
  visible_columns: string[];
};
export type SentEmail = {
  id: string;
  user_contact_id: string;
  recipient: string;
  subject: string;
  body: string;
  sent_at: string;
  gmail_message_id?: string;
};
export type Workspace = {
  profile?: {
    display_name: string | null;
    timezone: string;
    country: string | null;
  } | null;
  contactCount?: number;
  networkEntityIds?: string[];
  artist?: {
    id: string;
    name: string;
    type:
      | "solo"
      | "band"
      | "duo"
      | "collective"
      | "producer_project"
      | "dj_project"
      | "other";
    location: string;
    genres: string[];
    emotions: string[];
  } | null;
  demo: boolean;
  email: string;
  artistName: string;
  onboarded: boolean;
  isAdmin: boolean;
  contacts: Contact[];
  notes: Note[];
  interactions: Interaction[];
  lists: List[];
  members: { list_id: string; user_contact_id: string }[];
  views: SavedView[];
  templates: Template[];
  sent: SentEmail[];
  gmailEmail: string | null;
  goals: string[];
};
export const label = (s: string) =>
  s.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
export const contactName = (c: Contact) =>
  c.entity?.display_name || c.private_display_name || "Unnamed contact";
export const contactEmail = (c: Contact) =>
  c.private_email || c.entity?.email || "";
export function parseFilters(value: string | null): Filters {
  try {
    return filterSchema.parse(value ? JSON.parse(value) : {});
  } catch {
    return emptyFilters;
  }
}
export function serializeFilters(f: Filters) {
  return JSON.stringify(filterSchema.parse(f));
}
export function matchesEntity(e: Entity, f: Filters) {
  const has = (selected: string[], values: string[]) =>
    !selected.length ||
    selected.some((x) =>
      values.some((v) => v.toLowerCase() === x.toLowerCase()),
    );
  return (
    (!f.q ||
      [e.display_name, e.organisation, ...e.aliases]
        .join(" ")
        .toLowerCase()
        .includes(f.q.toLowerCase())) &&
    has(f.types, [e.entity_type]) &&
    has(f.roles, e.roles) &&
    has(f.organisationTypes, [e.organisation_type]) &&
    has(f.locations, [e.location]) &&
    has(expandGenres(f.genres, genreParents), e.genres) &&
    has(f.emotions, e.emotions) &&
    (!f.submission || f.submission === e.submission_status) &&
    (!f.submissionType || f.submissionType === e.submission_type) &&
    (!f.email || !!e.email) &&
    (!f.verified || e.verification_status === "verified") &&
    !f.exclude.some((x) =>
      [
        ...e.roles,
        ...e.genres,
        ...e.emotions,
        e.location,
        e.entity_type,
        e.organisation_type,
      ].includes(x),
    )
  );
}
export function matchesContact(
  c: Contact,
  f: Filters,
  members: Workspace["members"],
  today = new Date().toISOString().slice(0, 10),
) {
  const e =
    c.entity ||
    ({
      id: c.id,
      entity_type: "person",
      display_name: contactName(c),
      description: "",
      location: c.private_details.location || "",
      roles: [c.private_details.role || ""],
      organisation: c.private_details.organisation || "",
      organisation_type: "",
      genres: (c.private_details.genres || "").split(";"),
      emotions: [],
      email: contactEmail(c),
      website: "",
      verification_status: "unverified",
      submission_status: "unknown",
      submission_type: "",
      submission_instructions: "",
      aliases: [],
      source: "Private contact",
      source_url: "",
      verified_at: null,
      capacity: null,
    } as Entity);
  return (
    !c.archived &&
    (!f.lastContact ||
      (f.lastContact === "never"
        ? !c.last_contacted_at
        : !!c.last_contacted_at &&
          (f.lastContact === "recent"
            ? new Date(today).getTime() -
                new Date(c.last_contacted_at).getTime() <=
              30 * 86400000
            : new Date(today).getTime() -
                new Date(c.last_contacted_at).getTime() >
              30 * 86400000))) &&
    matchesEntity(e, f) &&
    (!f.relationship || f.relationship === c.relationship_status) &&
    (!f.outreach || f.outreach === c.outreach_status) &&
    (!f.priority || f.priority === c.priority) &&
    (!f.list ||
      members.some(
        (m) => m.list_id === f.list && m.user_contact_id === c.id,
      )) &&
    (!f.followUp ||
      (!!c.follow_up_at &&
        (f.followUp === "overdue"
          ? c.follow_up_at < today
          : f.followUp === "today"
            ? c.follow_up_at === today
            : c.follow_up_at > today)))
  );
}
export const templateVariables = [
  "first_name",
  "organisation",
  "artist_name",
  "contact_name",
] as const;
export function mergeTemplate(
  text: string,
  values: Record<(typeof templateVariables)[number], string>,
) {
  return text.replace(/{{\s*([^{}]+?)\s*}}/g, (_, key: string) => {
    if (!templateVariables.includes(key as (typeof templateVariables)[number]))
      throw new Error(`Unsupported variable: ${key}`);
    return values[key as (typeof templateVariables)[number]];
  });
}
export function duplicateKey(
  email: string,
  name: string,
  organisation: string,
) {
  return email.trim()
    ? email.trim().toLowerCase()
    : `${name.trim().toLowerCase()}|${organisation.trim().toLowerCase()}`;
}
export const privateContactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.union([z.email(), z.literal("")]).default(""),
  organisation: z.string().max(200).default(""),
  role: z.string().max(100).default(""),
  location: z.string().max(100).default(""),
  genres: z.string().max(300).default(""),
  notes: z.string().max(20000).default(""),
  relationship: z.enum(relationships).default("unknown"),
});
export const templateSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    category: z.string().max(80).default("Custom"),
    subject: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .refine((v) => !/[\r\n]/.test(v), "Subject must be one line"),
    body: z.string().trim().min(1).max(30000),
  })
  .refine((t) => {
    try {
      mergeTemplate(t.subject + t.body, {
        first_name: "",
        organisation: "",
        artist_name: "",
        contact_name: "",
      });
      return true;
    } catch {
      return false;
    }
  }, "Unsupported template variable");
export const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("profile"),
    display_name: z.string().trim().min(1).max(100),
    timezone: z
      .string()
      .max(80)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, "Choose a valid timezone"),
    country: z.string().max(80).default(""),
  }),
  z.object({ action: z.literal("add"), entityId: z.uuid() }),
  z.object({ action: z.literal("private"), contact: privateContactSchema }),
  z.object({
    action: z.literal("update"),
    id: z.uuid(),
    patch: z.object({
      private_display_name: z.string().trim().min(1).max(200).optional(),
      private_email: z.union([z.email(), z.literal("")]).optional(),
      private_details: z
        .record(z.string().max(50), z.string().max(500))
        .optional(),
      relationship_status: z.enum(relationships).optional(),
      outreach_status: z.enum(outreachStates).optional(),
      priority: z.enum(["low", "medium", "high"]).nullable().optional(),
      follow_up_at: z.iso.date().nullable().optional(),
      relationship_origin: z.string().max(500).optional(),
      archived: z.boolean().optional(),
    }),
  }),
  z.object({
    action: z.literal("note"),
    id: z.uuid(),
    body: z.string().trim().min(1).max(20000),
  }),
  z.object({
    action: z.literal("list"),
    name: z.string().trim().min(1).max(100),
  }),
  z.object({
    action: z.literal("member"),
    listId: z.uuid(),
    contactIds: z.array(z.uuid()).min(1).max(100),
    remove: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("view"),
    scope: z.enum(["explore", "network"]).default("explore"),
    name: z.string().trim().min(1).max(100),
    filters: filterSchema,
    columns: z.array(z.string()).max(20).default([]),
  }),
  z.object({
    action: z.literal("template"),
    id: z.uuid().optional(),
    template: templateSchema,
  }),
  z.object({ action: z.literal("deleteTemplate"), id: z.uuid() }),
  z.object({ action: z.literal("deleteList"), id: z.uuid() }),
  z.object({
    action: z.literal("import"),
    contacts: z.array(privateContactSchema).min(1).max(500),
    confirmDuplicates: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("onboard"),
    name: z.string().trim().min(1).max(200),
    type: z.enum([
      "solo",
      "band",
      "duo",
      "collective",
      "producer_project",
      "dj_project",
      "other",
    ]),
    location: z.string().max(100),
    genres: z.array(z.string()).max(5),
    emotions: z.array(z.string()).max(12),
    goals: z.array(z.string()).max(10),
  }),
]);
export type Action = z.infer<typeof actionSchema>;
