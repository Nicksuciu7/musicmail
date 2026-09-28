import { NextResponse } from "next/server";
import { z } from "zod";
import { identity, supabase, checked } from "@/lib/server/supabase";
import { body, errorResponse } from "@/lib/server/http";
const tableSchema = z.enum([
  "entity_contact_methods",
  "submission_channels",
  "entity_sources",
  "entity_aliases",
  "entity_roles",
  "genres",
  "emotions",
  "roles",
  "organisation_types",
]);
const id = z.uuid();
const text = z.string().max(5000);
const nullableText = text.nullable().optional();
const schemas = {
  entity_contact_methods: z.object({
    id: id.optional(),
    entity_id: id,
    contact_type: z.enum([
      "email",
      "phone",
      "website",
      "instagram",
      "linkedin",
      "tiktok",
      "youtube",
      "spotify",
      "bandcamp",
      "soundcloud",
      "submission_url",
    ]),
    value: text.min(1),
    label: nullableText,
    purpose: nullableText,
    is_primary: z.boolean().optional(),
    is_public: z.boolean().optional(),
    is_verified: z.boolean().optional(),
    last_verified_at: z.iso.datetime().nullable().optional(),
  }),
  submission_channels: z.object({
    id: id.optional(),
    entity_id: id,
    submission_type: z.enum([
      "demo",
      "booking",
      "festival",
      "press",
      "radio",
      "playlist",
      "management",
      "general",
    ]),
    status: z.enum(["open", "closed", "unknown"]),
    email_contact_method_id: id.nullable().optional(),
    submission_url: z.url().nullable().optional(),
    opens_at: z.iso.datetime().nullable().optional(),
    closes_at: z.iso.datetime().nullable().optional(),
    instructions: nullableText,
    fee_amount: z.number().nonnegative().nullable().optional(),
    fee_currency: z.string().length(3).nullable().optional(),
    last_verified_at: z.iso.datetime().nullable().optional(),
  }),
  entity_sources: z.object({
    id: id.optional(),
    entity_id: id,
    source_type: text,
    source_name: text,
    source_url: z.url().nullable().optional(),
    retrieved_at: z.iso.datetime().optional(),
    verified_at: z.iso.datetime().nullable().optional(),
  }),
  entity_aliases: z.object({
    id: id.optional(),
    entity_id: id,
    alias: text.min(1),
    normalised_alias: text.min(1),
  }),
  entity_roles: z.object({
    id: id.optional(),
    entity_id: id,
    role_id: id,
    organisation_id: id.nullable().optional(),
    started_at: z.iso.date().nullable().optional(),
    ended_at: z.iso.date().nullable().optional(),
    is_current: z.boolean().optional(),
  }),
  genres: z.object({
    id: id.optional(),
    name: text.min(1),
    slug: text.min(1),
    parent_genre_id: id.nullable().optional(),
  }),
  emotions: z.object({
    id: id.optional(),
    name: text.min(1),
    slug: text.min(1),
    family_id: id.nullable().optional(),
  }),
  roles: z.object({
    id: id.optional(),
    name: text.min(1),
    slug: text.min(1),
    description: nullableText,
  }),
  organisation_types: z.object({
    id: id.optional(),
    name: text.min(1),
    slug: text.min(1),
    description: nullableText,
  }),
};
async function admin() {
  if ((await identity()).demo) throw new Error("Admin unavailable in demo.");
  const db = await supabase();
  if (!checked(await db.rpc("is_admin"))) throw new Error("Admin required.");
  return db;
}
export async function GET(request: Request) {
  try {
    const db = await admin();
    const url = new URL(request.url);
    const table = tableSchema.parse(url.searchParams.get("table"));
    let q = db.from(table).select("*");
    if (table.startsWith("entity_") || table === "submission_channels")
      q = q.eq("entity_id", id.parse(url.searchParams.get("entityId")));
    return NextResponse.json(checked(await q.limit(500)));
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    const db = await admin();
    const input = z
      .object({
        table: tableSchema,
        action: z.enum(["save", "delete"]),
        record: z.unknown(),
      })
      .parse(await body(request));
    if (input.action === "delete") {
      const row = z.object({ id }).parse(input.record);
      checked(await db.from(input.table).delete().eq("id", row.id));
    } else {
      const row = schemas[input.table].parse(input.record);
      if (
        input.table === "entity_contact_methods" &&
        "contact_type" in row &&
        row.contact_type === "email" &&
        "value" in row
      )
        z.email().parse(row.value);
      const payload: Record<string, unknown> = { ...row };
      checked(await db.from(input.table).upsert(payload));
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
