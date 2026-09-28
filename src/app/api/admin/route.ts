import { NextResponse } from "next/server";
import { z } from "zod";
import { identity, supabase, checked } from "@/lib/server/supabase";
import { body, errorResponse } from "@/lib/server/http";
const inputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    document: z.object({
      id: z.uuid().optional(),
      entity_type: z.enum([
        "person",
        "organisation",
        "venue",
        "artist_project",
      ]),
      display_name: z.string().trim().min(1).max(200),
      description: z.string().max(5000),
      location: z.string(),
      organisation_type: z.string(),
      roles: z.array(z.string()),
      genres: z.array(z.string()),
      emotions: z.array(z.string()),
      aliases: z.array(z.string()),
      email: z.union([z.email(), z.literal("")]),
      verification_status: z.enum([
        "unverified",
        "verified",
        "potentially_outdated",
        "disputed",
      ]),
      submission_type: z.string(),
      submission_status: z.enum(["open", "closed", "unknown"]),
      submission_instructions: z.string(),
      source: z.string().trim().min(1),
      source_url: z.union([z.url(), z.literal("")]),
    }),
  }),
  z.object({ action: z.literal("archive"), id: z.uuid() }),
  z.object({
    action: z.literal("merge"),
    source: z.uuid(),
    target: z.uuid(),
    confirmed: z.literal(true),
  }),
  z.object({
    action: z.literal("taxonomy"),
    table: z.enum(["genres", "emotions", "roles", "organisation_types"]),
    name: z.string().trim().min(1).max(100),
    id: z.uuid().optional(),
  }),
]);
export async function POST(request: Request) {
  try {
    const u = await identity();
    if (u.demo) throw new Error("Admin is unavailable in demo mode.");
    const db = await supabase();
    if (!checked(await db.rpc("is_admin")))
      throw new Error("Admin access required.");
    const a = inputSchema.parse(await body(request));
    if (a.action === "save")
      checked(await db.rpc("admin_save_entity", { document: a.document }));
    if (a.action === "archive")
      checked(
        await db
          .from("entities")
          .update({ archived_at: new Date().toISOString() })
          .eq("id", a.id),
      );
    if (a.action === "merge")
      checked(
        await db.rpc("merge_entities", {
          source_id: a.source,
          target_id: a.target,
          confirmed: a.confirmed,
        }),
      );
    if (a.action === "taxonomy")
      checked(
        await db.from(a.table).upsert({
          ...(a.id ? { id: a.id } : {}),
          name: a.name,
          slug: a.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        }),
      );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
